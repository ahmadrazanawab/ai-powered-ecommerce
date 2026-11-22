import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
    orders,
    orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { requireCustomer } from "@/app/api/lib/customer-auth";

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response!;

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
        return NextResponse.json(
            { success: false, message: "Online payment is unavailable" },
            { status: 503 }
        );
    }

    const { orderId } = await params;

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
        order.status !== "pending" ||
        order.paymentStatus !== "pending"
    ) {
        return NextResponse.json(
            { success: false, message: "This payment cannot be retried" },
            { status: 409 }
        );
    }

    if (
        order.reservationExpiresAt &&
        order.reservationExpiresAt <= new Date()
    ) {
        return NextResponse.json(
            { success: false, message: "The payment reservation has expired" },
            { status: 409 }
        );
    }

    try {
        const stripe = new Stripe(secret);
        const appUrl =
            process.env.APP_URL?.replace(/\/$/, "") ||
            process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, "") ||
            _request.nextUrl.origin;

        if (order.paymentSessionId) {
            const existing = await stripe.checkout.sessions.retrieve(
                order.paymentSessionId
            );
            if (existing.status === "open" && existing.url) {
                return NextResponse.json({
                    success: true,
                    data: { checkoutUrl: existing.url },
                });
            }
        }

        const items = await db
            .select({
                productName: orderItems.productName,
                quantity: orderItems.quantity,
                unitPrice: orderItems.unitPrice,
            })
            .from(orderItems)
            .where(eq(orderItems.orderId, orderId));

        if (!items.length) {
            return NextResponse.json(
                { success: false, message: "Order items are unavailable" },
                { status: 409 }
            );
        }

        const session = await stripe.checkout.sessions.create(
            {
                mode: "payment",
                line_items: items.map((item) => ({
                    quantity: item.quantity,
                    price_data: {
                        currency: "inr",
                        unit_amount: Math.round(Number(item.unitPrice) * 100),
                        product_data: { name: item.productName },
                    },
                })),
                success_url: `${appUrl}/user/order-success/${orderId}?session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${appUrl}/user/checkout?cancelled=${orderId}`,
                metadata: {
                    orderId,
                    customerId: auth.customerId,
                },
                expires_at: Math.floor(
                    (order.reservationExpiresAt?.getTime() ??
                        Date.now() + 30 * 60 * 1000) / 1000
                ),
            },
            {
                idempotencyKey: `retry-checkout-session-${orderId}`,
            }
        );

        const paymentIntentId =
            typeof session.payment_intent === "string"
                ? session.payment_intent
                : session.payment_intent?.id ?? null;

        await db
            .update(orders)
            .set({
                paymentSessionId: session.id,
                paymentIntentId,
                updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));

        return NextResponse.json({
            success: true,
            data: { checkoutUrl: session.url },
        });
    } catch (error) {
        console.error("STRIPE_RETRY_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Unable to start payment retry" },
            { status: 502 }
        );
    }
}
