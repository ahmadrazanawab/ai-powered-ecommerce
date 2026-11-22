import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireCustomer } from "@/app/api/lib/customer-auth";
import { db } from "@/app/api/lib/db";
import {
    markRazorpayPaymentFailed,
} from "@/app/api/lib/razorpay-orders";
import {
    fetchRazorpayPayment,
    getRazorpayCredentials,
} from "@/app/api/lib/razorpay";
import { orders } from "@/app/api/lib/schema/checkout-schema";

export async function POST(request: NextRequest) {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response!;

    let parsedBody: unknown;
    try {
        parsedBody = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid request body" },
            { status: 400 }
        );
    }
    if (
        typeof parsedBody !== "object" ||
        parsedBody === null ||
        Array.isArray(parsedBody)
    ) {
        return NextResponse.json(
            { success: false, message: "Invalid request body" },
            { status: 400 }
        );
    }

    const body = parsedBody as Record<string, unknown>;
    const { orderId, razorpay_payment_id } = body;
    if (
        typeof orderId !== "string" ||
        typeof razorpay_payment_id !== "string"
    ) {
        return NextResponse.json(
            { success: false, message: "Order and payment IDs are required" },
            { status: 400 }
        );
    }

    try {
        const [order] = await db
            .select()
            .from(orders)
            .where(
                and(
                    eq(orders.id, orderId),
                    eq(orders.userId, auth.customerId)
                )
            )
            .limit(1);

        if (!order) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }
        if (
            order.paymentMethod !== "online" ||
            !order.razorpayOrderId
        ) {
            return NextResponse.json(
                { success: false, message: "This order has no Razorpay payment" },
                { status: 409 }
            );
        }

        getRazorpayCredentials();
        const payment = await fetchRazorpayPayment(razorpay_payment_id);
        if (payment.order_id !== order.razorpayOrderId) {
            return NextResponse.json(
                { success: false, message: "Payment does not belong to this order" },
                { status: 409 }
            );
        }

        const updated = await markRazorpayPaymentFailed(payment);
        return NextResponse.json({
            success: true,
            data: {
                orderId,
                paymentStatus: updated ? "failed" : order.paymentStatus,
            },
        });
    } catch (error) {
        console.error("RAZORPAY_FAILURE_ERROR", error);
        const code = error instanceof Error ? error.message : "";
        const status =
            code === "RAZORPAY_NOT_CONFIGURED" ? 503 :
                code.startsWith("RAZORPAY_API_ERROR:") ? 502 : 409;

        return NextResponse.json(
            {
                success: false,
                message:
                    status === 502
                        ? "Unable to confirm payment failure with Razorpay"
                        : "Payment failure could not be confirmed",
            },
            { status }
        );
    }
}
