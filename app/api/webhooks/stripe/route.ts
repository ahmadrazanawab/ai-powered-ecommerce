import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
    orders,
    orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";

export async function POST(request: NextRequest) {
    const signature = request.headers.get("stripe-signature");
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!signature || !secret || !stripeSecretKey) {
        return NextResponse.json(
            { message: "Webhook configuration missing" },
            { status: 400 }
        );
    }

    let event: Stripe.Event;
    const stripe = new Stripe(stripeSecretKey);

    try {
        event = stripe.webhooks.constructEvent(
            await request.text(),
            signature,
            secret
        );
    } catch (error) {
        console.error("STRIPE_SIGNATURE_ERROR", error);
        return NextResponse.json(
            { message: "Invalid signature" },
            { status: 400 }
        );
    }

    try {
        if (event.type === "checkout.session.completed") {
            const session = event.data.object as Stripe.Checkout.Session;
            await confirmCheckoutSession(session);
        }

        if (
            event.type === "payment_intent.succeeded"
        ) {
            const intent = event.data.object as Stripe.PaymentIntent;
            const orderId =
                intent.metadata.orderId ||
                (await findOrderIdByPaymentIntent(intent.id));

            if (orderId) {
                await confirmPaymentIntent(orderId, intent);
            }
        }

        if (
            event.type === "checkout.session.expired" ||
            event.type === "checkout.session.async_payment_failed"
        ) {
            const session = event.data.object as Stripe.Checkout.Session;
            await cancelOnlineReservation(
                session.metadata?.orderId ?? null,
                typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent?.id ?? null,
                session.id,
                event.type === "checkout.session.expired" ? "failed" : "failed"
            );
        }

        if (
            event.type === "payment_intent.payment_failed" ||
            event.type === "payment_intent.canceled"
        ) {
            const intent = event.data.object as Stripe.PaymentIntent;
            const orderId =
                intent.metadata.orderId ||
                (await findOrderIdByPaymentIntent(intent.id));

            if (orderId) {
                await cancelOnlineReservation(
                    orderId,
                    intent.id,
                    null,
                    event.type === "payment_intent.canceled"
                        ? "cancelled"
                        : "pending"
                );
            }
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("STRIPE_WEBHOOK_PROCESSING_ERROR", error);
        return NextResponse.json(
            { message: "Webhook processing failed" },
            { status: 500 }
        );
    }
}

async function findOrderIdByPaymentIntent(paymentIntentId: string) {
    const [order] = await db
        .select({ id: orders.id })
        .from(orders)
        .where(eq(orders.paymentIntentId, paymentIntentId))
        .limit(1);

    return order?.id ?? null;
}

async function confirmCheckoutSession(session: Stripe.Checkout.Session) {
    const orderId = session.metadata?.orderId;
    if (!orderId || session.payment_status !== "paid") return;

    await db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update")
            .limit(1);

        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.paymentMethod !== "online") {
            throw new Error("NOT_ONLINE_ORDER");
        }
        if (order.paymentSessionId !== session.id) {
            throw new Error("PAYMENT_SESSION_MISMATCH");
        }
        if (order.paymentStatus === "succeeded") return;
        if (order.status !== "pending") {
            throw new Error("ORDER_NOT_PENDING_PAYMENT");
        }

        const expectedAmount = Math.round(Number(order.subtotal) * 100);
        if (
            session.currency !== order.currency ||
            session.amount_total !== expectedAmount
        ) {
            throw new Error("PAYMENT_AMOUNT_MISMATCH");
        }

        const paymentIntentId =
            typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ??
                  order.paymentIntentId;

        await tx
            .update(orders)
            .set({
                status: "confirmed",
                paymentStatus: "succeeded",
                paymentSessionId: session.id,
                paymentIntentId,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));
    });
}

async function confirmPaymentIntent(
    orderId: string,
    intent: Stripe.PaymentIntent
) {
    await db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update")
            .limit(1);

        if (!order) throw new Error("ORDER_NOT_FOUND");
        if (order.paymentMethod !== "online") {
            throw new Error("NOT_ONLINE_ORDER");
        }
        if (order.paymentStatus === "succeeded") return;
        if (order.status !== "pending") {
            throw new Error("ORDER_NOT_PENDING_PAYMENT");
        }
        if (order.paymentIntentId !== intent.id) {
            throw new Error("PAYMENT_INTENT_MISMATCH");
        }

        const expectedAmount = Math.round(Number(order.subtotal) * 100);
        if (
            intent.currency !== order.currency ||
            intent.amount_received !== expectedAmount
        ) {
            throw new Error("PAYMENT_AMOUNT_MISMATCH");
        }

        await tx
            .update(orders)
            .set({
                status: "confirmed",
                paymentStatus: "succeeded",
                paymentIntentId: intent.id,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));
    });
}

async function cancelOnlineReservation(
    orderId: string | null,
    paymentIntentId: string | null,
    paymentSessionId: string | null,
    paymentStatus: "cancelled" | "failed" | "pending"
) {
    if (!orderId) return;

    await db.transaction(async (tx) => {
        const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update")
            .limit(1);

        if (
            !order ||
            order.status !== "pending" ||
            order.paymentMethod !== "online" ||
            order.paymentStatus !== "pending"
        ) {
            return;
        }

        if (
            (paymentIntentId &&
                order.paymentIntentId !== paymentIntentId) ||
            (paymentSessionId &&
                order.paymentSessionId !== paymentSessionId) ||
            (!paymentIntentId && !paymentSessionId)
        ) {
            return;
        }

        const items = await tx
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, orderId));

        for (const item of items) {
            if (item.stockRestored) continue;

            await tx
                .update(vendorProductSchema)
                .set({
                    stock: sql`${vendorProductSchema.stock} + ${item.quantity}`,
                    updatedAt: new Date(),
                })
                .where(eq(vendorProductSchema.id, item.listingId));

            await tx
                .update(orderItems)
                .set({ stockRestored: true })
                .where(eq(orderItems.id, item.id));
        }

        await tx
            .update(orders)
            .set({
                status: "cancelled",
                paymentStatus,
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(orders.id, orderId),
                    eq(orders.status, "pending"),
                    eq(orders.paymentStatus, "pending")
                )
            );
    });
}
