import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { orders } from "@/app/api/lib/schema/checkout-schema";
import { requireCustomer } from "@/app/api/lib/customer-auth";

export async function POST(request: NextRequest) {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response!;

    const secret = process.env.STRIPE_SECRET_KEY;
    if (!secret) {
        return NextResponse.json(
            { success: false, message: "Online payment is unavailable" },
            { status: 503 }
        );
    }

    let body: { sessionId?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid request body" },
            { status: 400 }
        );
    }

    if (typeof body.sessionId !== "string" || !body.sessionId) {
        return NextResponse.json(
            { success: false, message: "sessionId is required" },
            { status: 400 }
        );
    }

    try {
        const stripe = new Stripe(secret);
        const session = await stripe.checkout.sessions.retrieve(body.sessionId);
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            return NextResponse.json(
                { success: false, message: "Payment session is invalid" },
                { status: 400 }
            );
        }

        const result = await db.transaction(async (tx) => {
            const [order] = await tx
                .select()
                .from(orders)
                .where(
                    and(
                        eq(orders.id, orderId),
                        eq(orders.userId, auth.customerId!)
                    )
                )
                .for("update")
                .limit(1);

            if (!order) return { error: "NOT_FOUND" as const };
            if (order.paymentMethod !== "online") {
                return { error: "NOT_ONLINE" as const };
            }
            if (order.paymentSessionId !== session.id) {
                return { error: "SESSION_MISMATCH" as const };
            }

            const expectedAmount = Math.round(Number(order.subtotal) * 100);
            if (
                session.currency !== order.currency ||
                session.amount_total !== expectedAmount
            ) {
                return { error: "AMOUNT_MISMATCH" as const };
            }

            if (session.payment_status !== "paid") {
                return { error: "NOT_PAID" as const };
            }

            if (order.paymentStatus === "succeeded") {
                return { order };
            }

            if (order.status !== "pending") {
                return { error: "NOT_PENDING" as const };
            }

            const paymentIntentId =
                typeof session.payment_intent === "string"
                    ? session.payment_intent
                    : session.payment_intent?.id ?? order.paymentIntentId;

            const [updated] = await tx
                .update(orders)
                .set({
                    status: "confirmed",
                    paymentStatus: "succeeded",
                    paymentSessionId: session.id,
                    paymentIntentId,
                    updatedAt: new Date(),
                })
                .where(eq(orders.id, orderId))
                .returning();

            return { order: updated };
        });

        if ("error" in result) {
            const status =
                result.error === "NOT_FOUND" ? 404 : 409;
            const errorCode = String(result.error);
            const message: Record<string, string> = {
                NOT_FOUND: "Order not found",
                NOT_ONLINE: "This is not an online order",
                SESSION_MISMATCH: "Payment session does not belong to this order",
                AMOUNT_MISMATCH: "Payment amount mismatch",
                NOT_PAID: "Payment is not confirmed",
                NOT_PENDING: "Order payment status can no longer be changed",
            };
            return NextResponse.json(
                { success: false, message: message[errorCode] },
                { status }
            );
        }

        return NextResponse.json({
            success: true,
            data: {
                orderId,
                paymentStatus: result.order.paymentStatus,
                orderStatus: result.order.status,
            },
        });
    } catch (error) {
        console.error("STRIPE_VERIFY_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Unable to verify payment" },
            { status: 502 }
        );
    }
}
