import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireCustomer } from "@/app/api/lib/customer-auth";
import { db } from "@/app/api/lib/db";
import {
    confirmCapturedRazorpayPayment,
} from "@/app/api/lib/razorpay-orders";
import {
    fetchRazorpayPayment,
    getRazorpayCredentials,
    verifyRazorpayCheckoutSignature,
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
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } =
        body;
    if (
        typeof orderId !== "string" ||
        typeof razorpay_order_id !== "string" ||
        typeof razorpay_payment_id !== "string" ||
        typeof razorpay_signature !== "string"
    ) {
        return NextResponse.json(
            { success: false, message: "Payment verification data is required" },
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
            order.razorpayOrderId !== razorpay_order_id
        ) {
            return NextResponse.json(
                { success: false, message: "Payment does not match this order" },
                { status: 409 }
            );
        }

        const { keySecret } = getRazorpayCredentials();
        if (
            !verifyRazorpayCheckoutSignature(
                order.razorpayOrderId,
                razorpay_payment_id,
                razorpay_signature,
                keySecret
            )
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid payment signature" },
                { status: 400 }
            );
        }

        const payment = await fetchRazorpayPayment(razorpay_payment_id);
        if (payment.order_id !== order.razorpayOrderId) {
            return NextResponse.json(
                { success: false, message: "Payment does not belong to this order" },
                { status: 409 }
            );
        }
        if (payment.status !== "captured" || !payment.captured) {
            return NextResponse.json(
                { success: false, message: "Payment has not been captured" },
                { status: 409 }
            );
        }

        const confirmed = await confirmCapturedRazorpayPayment(payment);
        return NextResponse.json({
            success: true,
            data: {
                orderId: confirmed.id,
                orderStatus: confirmed.status,
                paymentStatus: confirmed.paymentStatus,
            },
        });
    } catch (error) {
        console.error("RAZORPAY_VERIFY_ERROR", error);
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
                        ? "Unable to verify payment with Razorpay"
                        : "Payment could not be verified",
            },
            { status }
        );
    }
}
