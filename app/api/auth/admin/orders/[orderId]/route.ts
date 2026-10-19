import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

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

    if (
      body.action !== "cancel" &&
      body.action !== "collect_cod"
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "action must be cancel or collect_cod",
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
      };

      return NextResponse.json(
        { success: false, message: errors[result.error!] },
        { status: result.error === "NOT_FOUND" ? 404 : 409 }
      );
    }

    return NextResponse.json({
      success: true,
      message:
        body.action === "cancel"
          ? "Order cancelled successfully"
          : "COD collection recorded",
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