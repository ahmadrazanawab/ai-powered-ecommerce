import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { orders } from "@/app/api/lib/schema/checkout-schema";
import { orderRefunds } from "@/app/api/lib/schema/refund-schema";
import { verifyAdminToken } from "../../../verify-token";

const methods = [
    "cash",
    "bank_transfer",
    "original_payment_method",
    "other",
] as const;

async function authorize(request: NextRequest) {
    const auth = await verifyAdminToken(request);

    if (!auth.success) return { response: auth.response };

    if (!["admin", "super_admin"].includes(auth.payload.role)) {
        return {
            response: NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 }
            ),
        };
    }

    return { adminId: auth.payload.adminId };
}

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const auth = await authorize(request);
        if ("response" in auth) return auth.response;

        const { orderId } = await params;

        const data = await db
            .select()
            .from(orderRefunds)
            .where(eq(orderRefunds.orderId, orderId));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("GET_REFUNDS_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch refunds" },
            { status: 500 }
        );
    }
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const auth = await authorize(request);
        if ("response" in auth) return auth.response;

        const { orderId } = await params;
        const body = await request.json();

        const amount = Number(body.amount);
        const method = body.method;

        if (
            !Number.isFinite(amount) ||
            amount <= 0 ||
            !methods.includes(method)
        ) {
            return NextResponse.json(
                { success: false, message: "Invalid amount or refund method" },
                { status: 400 }
            );
        }

        const result = await db.transaction(async (tx) => {
            const [order] = await tx
                .select()
                .from(orders)
                .where(eq(orders.id, orderId))
                .for("update")
                .limit(1);

            if (!order) return { error: "NOT_FOUND" as const };

            if (
                order.paymentMethod === "cod" &&
                !["paid", "succeeded"].includes(order.paymentStatus)
            ) {
                return { error: "COD_NOT_COLLECTED" as const };
            }

            if (!["paid", "succeeded", "refunded"].includes(order.paymentStatus)) {
                return { error: "NOT_PAID" as const };
            }

            const [totals] = await tx
                .select({
                    total: sql<string>`
            COALESCE(
              SUM(${orderRefunds.amount}),
              0
            )
          `,
                })
                .from(orderRefunds)
                .where(
                    and(
                        eq(orderRefunds.orderId, orderId),
                        sql`${orderRefunds.status} IN ('pending', 'processed')`
                    )
                );

            const alreadyReserved = Number(totals?.total ?? 0);
            const orderTotal = Number(order.subtotal);

            if (
                !Number.isFinite(orderTotal) ||
                Math.round((alreadyReserved + amount) * 100) >
                Math.round(orderTotal * 100)
            ) {
                return { error: "EXCEEDS_TOTAL" as const };
            }

            const [refund] = await tx
                .insert(orderRefunds)
                .values({
                    orderId,
                    amount: amount.toFixed(2),
                    method,
                    status: "pending",
                    reason:
                        typeof body.reason === "string" ? body.reason.trim() : null,
                    processedBy: auth.adminId,
                })
                .returning();

            return { refund };
        });

        if ("error" in result) {
            const errors: Record<string, string> = {
                NOT_FOUND: "Order not found",
                COD_NOT_COLLECTED: "Collect COD before creating a refund",
                NOT_PAID: "Only paid orders can be refunded",
                EXCEEDS_TOTAL: "Refunds cannot exceed the order subtotal",
            };

            return NextResponse.json(
                { success: false, message: errors[result.error!] },
                { status: result.error === "NOT_FOUND" ? 404 : 409 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Refund recorded as pending",
                data: result.refund,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE_REFUND_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Failed to create refund" },
            { status: 500 }
        );
    }
}