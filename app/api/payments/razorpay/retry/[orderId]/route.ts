import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireCustomer } from "@/app/api/lib/customer-auth";
import { db } from "@/app/api/lib/db";
import { startRazorpayOrder } from "@/app/api/lib/razorpay-orders";
import { orders } from "@/app/api/lib/schema/checkout-schema";

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response!;

    const { orderId } = await params;
    const [order] = await db
        .select({ id: orders.id })
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

    try {
        const paymentOrder = await startRazorpayOrder(order.id, true);
        return NextResponse.json({
            success: true,
            data: paymentOrder,
        });
    } catch (error) {
        console.error("RAZORPAY_RETRY_ERROR", error);
        const code = error instanceof Error ? error.message : "";
        const status =
            code === "ORDER_NOT_FOUND" ? 404 :
                code === "RAZORPAY_NOT_CONFIGURED" ? 503 :
                    code.startsWith("RAZORPAY_API_ERROR:") ? 502 : 409;

        return NextResponse.json(
            {
                success: false,
                message:
                    status === 502
                        ? "Unable to start a payment retry"
                        : code === "PAYMENT_ALREADY_COMPLETED"
                            ? "This order has already been paid"
                            : code === "PAYMENT_RESERVATION_EXPIRED"
                                ? "The payment reservation has expired"
                                : "This payment cannot be retried",
            },
            { status }
        );
    }
}
