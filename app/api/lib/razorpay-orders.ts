import { and, eq, inArray, isNull } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
    orders,
    orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import {
    createRazorpayOrder,
    fetchRazorpayOrder,
    fetchRazorpayOrderPayments,
    getRazorpayCredentials,
    toRazorpayPaise,
    type RazorpayPayment,
} from "@/app/api/lib/razorpay";

export async function startRazorpayOrder(
    orderId: string,
    allowRetry = false
) {
    const { keyId } = getRazorpayCredentials();

    return db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update")
            .limit(1);

        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.paymentMethod !== "online") {
            throw new Error("NOT_AN_ONLINE_ORDER");
        }
        if (order.status !== "pending") {
            throw new Error("ORDER_NOT_PENDING");
        }
        if (
            order.paymentStatus === "succeeded" ||
            order.paymentStatus === "paid"
        ) {
            throw new Error("PAYMENT_ALREADY_COMPLETED");
        }
        if (
            order.paymentStatus === "failed" &&
            !allowRetry
        ) {
            throw new Error("PAYMENT_RETRY_REQUIRED");
        }
        if (
            !order.reservationExpiresAt ||
            order.reservationExpiresAt <= new Date()
        ) {
            throw new Error("PAYMENT_RESERVATION_EXPIRED");
        }

        if (order.paymentStatus === "failed") {
            await tx
                .update(orders)
                .set({
                    paymentStatus: "pending",
                    razorpayPaymentId: null,
                    updatedAt: new Date(),
                })
                .where(eq(orders.id, order.id));
        }

        const amount = toRazorpayPaise(order.subtotal);
        const currency = order.currency.toUpperCase();
        let razorpayOrderId = order.razorpayOrderId;

        if (!razorpayOrderId) {
            const gatewayOrder = await createRazorpayOrder({
                amount,
                currency,
                receipt: order.id,
            });

            if (
                gatewayOrder.amount !== amount ||
                gatewayOrder.currency.toUpperCase() !== currency ||
                gatewayOrder.receipt !== order.id
            ) {
                throw new Error("RAZORPAY_ORDER_MISMATCH");
            }

            razorpayOrderId = gatewayOrder.id;

            const [updatedOrder] = await tx
                .update(orders)
                .set({
                    razorpayOrderId,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(orders.id, order.id),
                        isNull(orders.razorpayOrderId)
                    )
                )
                .returning({ id: orders.id });

            if (!updatedOrder) {
                throw new Error("RAZORPAY_ORDER_ALREADY_CREATED");
            }
        } else {
            const gatewayOrder = await fetchRazorpayOrder(razorpayOrderId);
            if (
                gatewayOrder.amount !== amount ||
                gatewayOrder.currency.toUpperCase() !== currency ||
                gatewayOrder.receipt !== order.id
            ) {
                throw new Error("RAZORPAY_ORDER_MISMATCH");
            }

            if (gatewayOrder.status === "paid") {
                const { items } =
                    await fetchRazorpayOrderPayments(razorpayOrderId);
                const capturedPayment = items.find(
                    (payment) =>
                        payment.status === "captured" && payment.captured
                );

                if (!capturedPayment) {
                    throw new Error("RAZORPAY_PAYMENT_PROCESSING");
                }

                return {
                    alreadyPaid: true,
                    keyId,
                    orderId: order.id,
                    payment: capturedPayment,
                } as const;
            }

            if (
                gatewayOrder.status !== "created" &&
                gatewayOrder.status !== "attempted"
            ) {
                throw new Error("RAZORPAY_ORDER_NOT_PAYABLE");
            }
        }

        return {
            alreadyPaid: false,
            keyId,
            orderId: order.id,
            razorpayOrderId,
            amount,
            currency,
        } as const;
    }).then(async (result) => {
        if (result.alreadyPaid) {
            await confirmCapturedRazorpayPayment(result.payment);
            throw new Error("PAYMENT_ALREADY_COMPLETED");
        }

        return result;
    });
}

export async function confirmCapturedRazorpayPayment(
    payment: RazorpayPayment
) {
    if (payment.status !== "captured" || !payment.captured) {
        throw new Error("RAZORPAY_PAYMENT_NOT_CAPTURED");
    }

    return db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.razorpayOrderId, payment.order_id))
            .for("update")
            .limit(1);

        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.paymentMethod !== "online") {
            throw new Error("NOT_AN_ONLINE_ORDER");
        }

        const expectedAmount = toRazorpayPaise(order.subtotal);
        if (
            payment.amount !== expectedAmount ||
            payment.currency.toUpperCase() !== order.currency.toUpperCase()
        ) {
            throw new Error("RAZORPAY_AMOUNT_MISMATCH");
        }

        if (order.paymentStatus === "succeeded") {
            if (order.razorpayPaymentId === payment.id) return order;
            throw new Error("PAYMENT_ALREADY_COMPLETED");
        }

        if (
            order.status !== "pending" ||
            !["pending", "failed"].includes(order.paymentStatus)
        ) {
            throw new Error("ORDER_NOT_PENDING");
        }

        const items = await tx
            .select({ stockRestored: orderItems.stockRestored })
            .from(orderItems)
            .where(eq(orderItems.orderId, order.id));

        if (!items.length || items.some((item) => item.stockRestored)) {
            throw new Error("ORDER_RESERVATION_NOT_ACTIVE");
        }

        const [updatedOrder] = await tx
            .update(orders)
            .set({
                status: "confirmed",
                paymentStatus: "succeeded",
                razorpayPaymentId: payment.id,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(orders.id, order.id),
                    eq(orders.status, "pending"),
                    inArray(orders.paymentStatus, ["pending", "failed"])
                )
            )
            .returning();

        if (!updatedOrder) throw new Error("ORDER_NOT_PENDING");
        return updatedOrder;
    });
}

export async function markRazorpayPaymentFailed(
    payment: RazorpayPayment
) {
    if (payment.status !== "failed" || payment.captured) {
        throw new Error("RAZORPAY_PAYMENT_NOT_FAILED");
    }

    return db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.razorpayOrderId, payment.order_id))
            .for("update")
            .limit(1);

        if (!order) return false;
        if (order.paymentMethod !== "online") {
            throw new Error("NOT_AN_ONLINE_ORDER");
        }
        if (
            payment.amount !== toRazorpayPaise(order.subtotal) ||
            payment.currency.toUpperCase() !== order.currency.toUpperCase()
        ) {
            throw new Error("RAZORPAY_AMOUNT_MISMATCH");
        }
        if (
            order.status !== "pending" ||
            order.paymentStatus === "succeeded" ||
            order.paymentStatus === "paid"
        ) {
            return false;
        }

        await tx
            .update(orders)
            .set({
                paymentStatus: "failed",
                razorpayPaymentId: payment.id,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(orders.id, order.id),
                    eq(orders.status, "pending"),
                    inArray(orders.paymentStatus, ["pending", "failed"])
                )
            );

        return true;
    });
}

export async function reconcileRazorpayOrder(orderId: string) {
    const [order] = await db
        .select({
            id: orders.id,
            subtotal: orders.subtotal,
            currency: orders.currency,
            paymentMethod: orders.paymentMethod,
            razorpayOrderId: orders.razorpayOrderId,
        })
        .from(orders)
        .where(eq(orders.id, orderId))
        .limit(1);

    if (!order || order.paymentMethod !== "online" || !order.razorpayOrderId) {
        return false;
    }

    const gatewayOrder = await fetchRazorpayOrder(order.razorpayOrderId);
    if (
        gatewayOrder.receipt !== order.id ||
        gatewayOrder.amount !== toRazorpayPaise(order.subtotal) ||
        gatewayOrder.currency.toUpperCase() !== order.currency.toUpperCase()
    ) {
        throw new Error("RAZORPAY_ORDER_MISMATCH");
    }

    if (gatewayOrder.status !== "paid") return false;

    const { items } = await fetchRazorpayOrderPayments(order.razorpayOrderId);
    const payment = items.find(
        (item) => item.status === "captured" && item.captured
    );
    if (!payment || payment.order_id !== order.razorpayOrderId) {
        throw new Error("RAZORPAY_PAYMENT_PROCESSING");
    }

    await confirmCapturedRazorpayPayment(payment);
    return true;
}
