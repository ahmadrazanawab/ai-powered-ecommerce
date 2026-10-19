import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { requireCustomer } from "@/app/api/lib/customer-auth";
import {
    orders,
    orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import {
    restoreItemStock,
    refreshOrderStatus,
} from "../../../lib/schema/order-management";

export async function POST(
    _request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const auth = await requireCustomer();
        if (!auth.customerId) return auth.response;

        const { orderId } = await params;

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

            if (!["pending", "confirmed"].includes(order.status)) {
                return { error: "CANNOT_CANCEL" as const };
            }

            const items = await tx
                .select()
                .from(orderItems)
                .where(eq(orderItems.orderId, orderId))
                .for("update");

            if (
                items.length === 0 ||
                items.some((item) => item.fulfillmentStatus !== "pending")
            ) {
                return { error: "CANNOT_CANCEL" as const };
            }

            for (const item of items) {
                await restoreItemStock(tx, item.id);
            }

            await tx
                .update(orderItems)
                .set({ fulfillmentStatus: "cancelled" })
                .where(eq(orderItems.orderId, orderId));

            await tx
                .update(orders)
                .set({
                    status: "cancelled",
                    updatedAt: new Date(),
                })
                .where(eq(orders.id, orderId));

            return { success: true };
        });

        if ("error" in result) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        result.error === "NOT_FOUND"
                            ? "Order not found"
                            : "Order can no longer be cancelled",
                },
                { status: result.error === "NOT_FOUND" ? 404 : 409 }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Order cancelled successfully",
        });
    } catch (error) {
        console.error("CUSTOMER_CANCEL_ORDER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Failed to cancel order" },
            { status: 500 }
        );
    }
}