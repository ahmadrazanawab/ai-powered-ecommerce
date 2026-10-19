import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import {
  orderItems,
  orders,
} from "@/app/api/lib/schema/checkout-schema";
import { verifyVendorToken } from "../../verify-token-vendor";

const transitions: Record<string, string[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

const allowed = new Set([
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await verifyVendorToken(request);
    if (!auth.success) return auth.response;

    const { itemId } = await params;
    const body = await request.json();
    const nextStatus = body.status;

    if (
      typeof nextStatus !== "string" ||
      !allowed.has(nextStatus)
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid fulfillment status" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const [item] = await tx
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.id, itemId),
            eq(orderItems.vendorId, auth.payload.vendorId)
          )
        )
        .for("update")
        .limit(1);

      if (!item) return { error: "NOT_FOUND" as const };

      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, item.orderId))
        .limit(1);

      if (!order || order.paymentStatus !== "succeeded") {
        return { error: "NOT_PAID" as const };
      }

      if (!transitions[item.fulfillmentStatus]?.includes(nextStatus)) {
        return { error: "INVALID_TRANSITION" as const };
      }

      const [updated] = await tx
        .update(orderItems)
        .set({ fulfillmentStatus: nextStatus as typeof item.fulfillmentStatus })
        .where(eq(orderItems.id, item.id))
        .returning();

      return { item: updated };
    });

    if ("error" in result) {
      const status =
        result.error === "NOT_FOUND" ? 404 :
        result.error === "NOT_PAID" ? 409 : 400;

      return NextResponse.json(
        {
          success: false,
          message: {
            NOT_FOUND: "Vendor order item not found",
            NOT_PAID: "Only paid orders can be fulfilled",
            INVALID_TRANSITION: "Invalid fulfillment status transition",
          },
        },
        { status }
      );
    }

    return NextResponse.json({ success: true, data: result.item });
  } catch (error) {
    console.error("VENDOR_ORDER_UPDATE_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to update fulfillment status" },
      { status: 500 }
    );
  }
}