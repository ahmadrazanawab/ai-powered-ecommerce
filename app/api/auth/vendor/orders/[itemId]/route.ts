import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
  orderItems,
  orders,
} from "@/app/api/lib/schema/checkout-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { verifyVendorToken } from "../../verify-token-vendor";
import {
  restoreItemStock,
  refreshOrderStatus,
} from "@/app/api/lib/schema/order-management";

const allowedStatuses = [
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const transitions: Record<string, string[]> = {
  pending: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: [],
  cancelled: [],
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await verifyVendorToken(request);
    if (!auth.success) return auth.response;

    const { itemId } = await params;
    const body = await request.json();
    const nextStatus: unknown = body.status;

    if (
      typeof nextStatus !== "string" ||
      !allowedStatuses.includes(nextStatus as (typeof allowedStatuses)[number])
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid fulfillment status" },
        { status: 400 }
      );
    }

    const result = await db.transaction(async (tx) => {
      const [vendor] = await tx
        .select({ id: vendors.id })
        .from(vendors)
        .where(
          and(
            eq(vendors.id, auth.payload.vendorId),
            eq(vendors.status, "approved"),
            eq(vendors.isActive, true)
          )
        )
        .limit(1);

      if (!vendor) return { error: "VENDOR_INACTIVE" as const };

      const [item] = await tx
        .select()
        .from(orderItems)
        .where(
          and(
            eq(orderItems.id, itemId),
            eq(orderItems.vendorId, vendor.id)
          )
        )
        .for("update")
        .limit(1);

      if (!item) return { error: "NOT_FOUND" as const };

      const [order] = await tx
        .select()
        .from(orders)
        .where(eq(orders.id, item.orderId))
        .for("update")
        .limit(1);

      if (!order) return { error: "NOT_FOUND" as const };

      // COD can be fulfilled while payment is pending.
      // Online orders require successful payment.
      if (
        order.paymentMethod === "online" &&
        !["paid", "succeeded"].includes(order.paymentStatus)
      ) {
        return { error: "NOT_PAID" as const };
      }

      if (!transitions[item.fulfillmentStatus]?.includes(nextStatus)) {
        return { error: "INVALID_TRANSITION" as const };
      }

      if (nextStatus === "cancelled") {
        await restoreItemStock(tx, item.id);
      }

      const [updatedItem] = await tx
        .update(orderItems)
        .set({
          fulfillmentStatus:
            nextStatus as (typeof allowedStatuses)[number],
        })
        .where(eq(orderItems.id, item.id))
        .returning();

      await refreshOrderStatus(tx, order.id);

      return { item: updatedItem };
    });

    if ("error" in result) {
      const errors: Record<string, { status: number; message: string }> = {
        VENDOR_INACTIVE: {
          status: 403,
          message: "Vendor account is inactive or unapproved",
        },
        NOT_FOUND: { status: 404, message: "Order item not found" },
        NOT_PAID: {
          status: 409,
          message: "Online order must be paid before fulfillment",
        },
        INVALID_TRANSITION: {
          status: 409,
          message: "Invalid fulfillment status transition",
        },
      };

      const failure = errors[result.error!];

      return NextResponse.json(
        { success: false, message: failure.message },
        { status: failure.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Fulfillment status updated",
      data: result.item,
    });
  } catch (error) {
    console.error("VENDOR_ORDER_UPDATE_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Failed to update fulfillment status" },
      { status: 500 }
    );
  }
}

