// file : app/api/auth/admin/orders/[orderId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
    orders,
    orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { verifyAdminToken } from "../../verify-token";
import {
    restoreItemStock,
    refreshOrderStatus,
} from "@/app/api/lib/schema/order-management";

type OrderStatus = typeof orders.$inferSelect.status;
type ItemStatus = typeof orderItems.$inferSelect.fulfillmentStatus;

// The only allowed forward step from each order status.
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
    pending: "confirmed",
    confirmed: "processing",
    processing: "shipped",
    shipped: "delivered",
};

// Items have no "confirmed" state, so "confirmed" maps to nothing here.
const ITEM_RANK: Record<ItemStatus, number> = {
    pending: 0,
    processing: 1,
    shipped: 2,
    delivered: 3,
    cancelled: -1,
};

const ACTIONS = ["cancel", "collect_cod", "update_status"] as const;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const auth = await verifyAdminToken(request);
        if (!auth.success) return auth.response;

        if (!["admin", "super_admin"].includes(auth.payload.role)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 }
            );
        }

        const { orderId } = await params;

        const [order] = await db
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .limit(1);

        if (!order) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }

        const items = await db
            .select()
            .from(orderItems)
            .where(eq(orderItems.orderId, orderId));

        return NextResponse.json({
            success: true,
            data: { ...order, items },
        });
    } catch (error) {
        console.error("ADMIN_GET_ORDER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch order" },
            { status: 500 }
        );
    }
}

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const auth = await verifyAdminToken(request);
        if (!auth.success) return auth.response;

        if (!["admin", "super_admin"].includes(auth.payload.role)) {
            return NextResponse.json(
                { success: false, message: "Forbidden" },
                { status: 403 }
            );
        }

        const { orderId } = await params;
        const body = await request.json();

        if (!ACTIONS.includes(body.action)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "action must be cancel, collect_cod or update_status",
                },
                { status: 400 }
            );
        }

        if (
            body.action === "update_status" &&
            !["confirmed", "processing", "shipped", "delivered"].includes(
                body.status
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "status must be confirmed, processing, shipped or delivered",
                },
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

            /* ---------- move the order forward one step ---------- */
            if (body.action === "update_status") {
                const target = body.status as OrderStatus;

                if (NEXT_STATUS[order.status] !== target) {
                    return { error: "INVALID_TRANSITION" as const };
                }

                if (target === "confirmed") {
                    // Online orders must be paid before they can be confirmed.
                    if (
                        order.paymentMethod === "online" &&
                        !["paid", "succeeded"].includes(order.paymentStatus)
                    ) {
                        return { error: "PAYMENT_PENDING" as const };
                    }

                    const [updated] = await tx
                        .update(orders)
                        .set({ status: "confirmed", updatedAt: new Date() })
                        .where(eq(orders.id, order.id))
                        .returning();

                    return { order: updated };
                }

                const items = await tx
                    .select()
                    .from(orderItems)
                    .where(eq(orderItems.orderId, order.id))
                    .for("update");

                const active = items.filter(
                    (item) => item.fulfillmentStatus !== "cancelled"
                );

                if (active.length === 0) return { error: "NO_ACTIVE_ITEMS" as const };

                // Only move items that are behind the target (never backwards).
                const behind = active
                    .filter(
                        (item) =>
                            ITEM_RANK[item.fulfillmentStatus] <
                            ITEM_RANK[target as ItemStatus]
                    )
                    .map((item) => item.id);

                if (behind.length > 0) {
                    await tx
                        .update(orderItems)
                        .set({ fulfillmentStatus: target as ItemStatus })
                        .where(
                            and(
                                eq(orderItems.orderId, order.id),
                                inArray(orderItems.id, behind)
                            )
                        );
                }

                await refreshOrderStatus(tx, order.id);

                const [updated] = await tx
                    .select()
                    .from(orders)
                    .where(eq(orders.id, order.id))
                    .limit(1);

                return { order: updated };
            }

            /* ---------- record COD cash collected ---------- */
            if (body.action === "collect_cod") {
                if (order.paymentMethod !== "cod") {
                    return { error: "NOT_COD" as const };
                }

                if (order.status !== "delivered") {
                    return { error: "NOT_DELIVERED" as const };
                }

                if (order.paymentStatus === "refunded") {
                    return { error: "ALREADY_REFUNDED" as const };
                }

                if (["paid", "succeeded"].includes(order.paymentStatus)) {
                    return { error: "ALREADY_PAID" as const };
                }

                const [updated] = await tx
                    .update(orders)
                    .set({
                        paymentStatus: "paid",
                        updatedAt: new Date(),
                    })
                    .where(eq(orders.id, order.id))
                    .returning();

                return { order: updated };
            }

            /* ---------- cancel ---------- */
            if (["shipped", "delivered", "cancelled"].includes(order.status)) {
                return { error: "CANNOT_CANCEL" as const };
            }

            const items = await tx
                .select()
                .from(orderItems)
                .where(eq(orderItems.orderId, order.id))
                .for("update");

            if (
                items.length === 0 ||
                items.some((item) =>
                    ["shipped", "delivered"].includes(item.fulfillmentStatus)
                )
            ) {
                return { error: "CANNOT_CANCEL" as const };
            }

            for (const item of items) {
                if (item.fulfillmentStatus !== "cancelled") {
                    await restoreItemStock(tx, item.id);
                }
            }

            await tx
                .update(orderItems)
                .set({ fulfillmentStatus: "cancelled" })
                .where(eq(orderItems.orderId, order.id));

            const [updated] = await tx
                .update(orders)
                .set({
                    status: "cancelled",
                    updatedAt: new Date(),
                })
                .where(eq(orders.id, order.id))
                .returning();

            return { order: updated };
        });

        if ("error" in result) {
            const errors: Record<string, string> = {
                NOT_FOUND: "Order not found",
                NOT_COD: "Only COD orders can use this collection action",
                NOT_DELIVERED: "COD can be recorded as collected only after delivery",
                ALREADY_REFUNDED: "This order has already been refunded",
                ALREADY_PAID: "Payment has already been recorded",
                CANNOT_CANCEL:
                    "This order cannot be cancelled because of its current status",
                INVALID_TRANSITION:
                    "This order can't move to that status from its current one",
                PAYMENT_PENDING:
                    "Online payment hasn't been received yet, so the order can't be confirmed",
                NO_ACTIVE_ITEMS: "This order has no active items to update",
            };

            return NextResponse.json(
                { success: false, message: errors[result.error!] },
                { status: result.error === "NOT_FOUND" ? 404 : 409 }
            );
        }

        const messages: Record<string, string> = {
            cancel: "Order cancelled successfully",
            collect_cod: "COD collection recorded",
            update_status: `Order marked as ${result.order.status}`,
        };

        return NextResponse.json({
            success: true,
            message: messages[body.action],
            data: result.order,
        });
    } catch (error) {
        console.error("ADMIN_UPDATE_ORDER_ERROR", error);

        return NextResponse.json(
            { success: false, message: "Failed to update order" },
            { status: 500 }
        );
    }
}



// file : app/api/auth/admin/orders/[orderId]/route.ts
// import { NextRequest, NextResponse } from "next/server";
// import { eq } from "drizzle-orm";

// import { db } from "@/app/api/lib/db";
// import {
//   orders,
//   orderItems,
// } from "@/app/api/lib/schema/checkout-schema";
// import { verifyAdminToken } from "../../verify-token";
// import {
//   restoreItemStock,
//   refreshOrderStatus,
// } from "@/app/api/lib/schema/order-management";

// export async function GET(
//   request: NextRequest,
//   { params }: { params: Promise<{ orderId: string }> }
// ) {
//   try {
//     const auth = await verifyAdminToken(request);
//     if (!auth.success) return auth.response;

//     if (!["admin", "super_admin"].includes(auth.payload.role)) {
//       return NextResponse.json(
//         { success: false, message: "Forbidden" },
//         { status: 403 }
//       );
//     }

//     const { orderId } = await params;

//     const [order] = await db
//       .select()
//       .from(orders)
//       .where(eq(orders.id, orderId))
//       .limit(1);

//     if (!order) {
//       return NextResponse.json(
//         { success: false, message: "Order not found" },
//         { status: 404 }
//       );
//     }

//     const items = await db
//       .select()
//       .from(orderItems)
//       .where(eq(orderItems.orderId, orderId));

//     return NextResponse.json({
//       success: true,
//       data: { ...order, items },
//     });
//   } catch (error) {
//     console.error("ADMIN_GET_ORDER_ERROR", error);

//     return NextResponse.json(
//       { success: false, message: "Failed to fetch order" },
//       { status: 500 }
//     );
//   }
// }

// export async function PATCH(
//   request: NextRequest,
//   { params }: { params: Promise<{ orderId: string }> }
// ) {
//   try {
//     const auth = await verifyAdminToken(request);
//     if (!auth.success) return auth.response;

//     if (!["admin", "super_admin"].includes(auth.payload.role)) {
//       return NextResponse.json(
//         { success: false, message: "Forbidden" },
//         { status: 403 }
//       );
//     }

//     const { orderId } = await params;
//     const body = await request.json();

//     if (
//       body.action !== "cancel" &&
//       body.action !== "collect_cod"
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "action must be cancel or collect_cod",
//         },
//         { status: 400 }
//       );
//     }

//     const result = await db.transaction(async (tx) => {
//       const [order] = await tx
//         .select()
//         .from(orders)
//         .where(eq(orders.id, orderId))
//         .for("update")
//         .limit(1);

//       if (!order) return { error: "NOT_FOUND" as const };

//       if (body.action === "collect_cod") {
//         if (order.paymentMethod !== "cod") {
//           return { error: "NOT_COD" as const };
//         }

//         if (order.status !== "delivered") {
//           return { error: "NOT_DELIVERED" as const };
//         }

//         if (order.paymentStatus === "refunded") {
//           return { error: "ALREADY_REFUNDED" as const };
//         }

//         if (["paid", "succeeded"].includes(order.paymentStatus)) {
//           return { error: "ALREADY_PAID" as const };
//         }

//         const [updated] = await tx
//           .update(orders)
//           .set({
//             paymentStatus: "paid",
//             updatedAt: new Date(),
//           })
//           .where(eq(orders.id, order.id))
//           .returning();

//         return { order: updated };
//       }

//       if (["shipped", "delivered", "cancelled"].includes(order.status)) {
//         return { error: "CANNOT_CANCEL" as const };
//       }

//       const items = await tx
//         .select()
//         .from(orderItems)
//         .where(eq(orderItems.orderId, order.id))
//         .for("update");

//       if (
//         items.length === 0 ||
//         items.some((item) =>
//           ["shipped", "delivered"].includes(item.fulfillmentStatus)
//         )
//       ) {
//         return { error: "CANNOT_CANCEL" as const };
//       }

//       for (const item of items) {
//         if (item.fulfillmentStatus !== "cancelled") {
//           await restoreItemStock(tx, item.id);
//         }
//       }

//       await tx
//         .update(orderItems)
//         .set({ fulfillmentStatus: "cancelled" })
//         .where(eq(orderItems.orderId, order.id));

//       const [updated] = await tx
//         .update(orders)
//         .set({
//           status: "cancelled",
//           updatedAt: new Date(),
//         })
//         .where(eq(orders.id, order.id))
//         .returning();

//       return { order: updated };
//     });

//     if ("error" in result) {
//       const errors: Record<string, string> = {
//         NOT_FOUND: "Order not found",
//         NOT_COD: "Only COD orders can use this collection action",
//         NOT_DELIVERED: "COD can be recorded as collected only after delivery",
//         ALREADY_REFUNDED: "This order has already been refunded",
//         ALREADY_PAID: "Payment has already been recorded",
//         CANNOT_CANCEL:
//           "This order cannot be cancelled because of its current status",
//       };

//       return NextResponse.json(
//         { success: false, message: errors[result.error!] },
//         { status: result.error === "NOT_FOUND" ? 404 : 409 }
//       );
//     }

//     return NextResponse.json({
//       success: true,
//       message:
//         body.action === "cancel"
//           ? "Order cancelled successfully"
//           : "COD collection recorded",
//       data: result.order,
//     });
//   } catch (error) {
//     console.error("ADMIN_UPDATE_ORDER_ERROR", error);

//     return NextResponse.json(
//       { success: false, message: "Failed to update order" },
//       { status: 500 }
//     );
//   }
// }