import { NextRequest, NextResponse } from "next/server";

import {
    markRazorpayPaymentFailed,
    confirmCapturedRazorpayPayment,
} from "@/app/api/lib/razorpay-orders";
import {
    verifyRazorpayWebhookSignature,
    type RazorpayPayment,
} from "@/app/api/lib/razorpay";

interface RazorpayWebhookEvent {
    event?: unknown;
    payload?: {
        payment?: {
            entity?: unknown;
        };
    };
}

function isRazorpayPayment(value: unknown): value is RazorpayPayment {
    if (typeof value !== "object" || value === null) return false;
    const payment = value as Record<string, unknown>;

    return (
        typeof payment.id === "string" &&
        typeof payment.order_id === "string" &&
        typeof payment.amount === "number" &&
        typeof payment.currency === "string" &&
        typeof payment.status === "string" &&
        typeof payment.captured === "boolean"
    );
}

export async function POST(request: NextRequest) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = request.headers.get("x-razorpay-signature");

    if (!webhookSecret || !signature) {
        return NextResponse.json(
            { success: false, message: "Webhook configuration is missing" },
            { status: 503 }
        );
    }

    const rawBody = await request.text();
    if (!verifyRazorpayWebhookSignature(rawBody, signature, webhookSecret)) {
        return NextResponse.json(
            { success: false, message: "Invalid webhook signature" },
            { status: 400 }
        );
    }

    let parsedEvent: unknown;
    try {
        parsedEvent = JSON.parse(rawBody);
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid webhook payload" },
            { status: 400 }
        );
    }
    if (
        typeof parsedEvent !== "object" ||
        parsedEvent === null ||
        Array.isArray(parsedEvent)
    ) {
        return NextResponse.json(
            { success: false, message: "Invalid webhook payload" },
            { status: 400 }
        );
    }

    const event = parsedEvent as RazorpayWebhookEvent;
    const eventType = event.event;
    if (
        eventType !== "payment.captured" &&
        eventType !== "payment.failed"
    ) {
        return NextResponse.json({ received: true });
    }

    const payment = event.payload?.payment?.entity;
    if (!isRazorpayPayment(payment)) {
        return NextResponse.json(
            { success: false, message: "Invalid payment webhook payload" },
            { status: 400 }
        );
    }

    try {
        if (eventType === "payment.captured") {
            await confirmCapturedRazorpayPayment(payment);
        } else {
            await markRazorpayPaymentFailed(payment);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("RAZORPAY_WEBHOOK_PROCESSING_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Webhook processing failed" },
            { status: 500 }
        );
    }
}
