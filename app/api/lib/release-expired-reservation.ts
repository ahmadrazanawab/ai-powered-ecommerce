
import { and, eq, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
  orders,
  orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";

export async function releaseExpiredReservation(
  orderId: string
): Promise<boolean> {
  return db.transaction(async (tx) => {
    // Lock the order so concurrent cron/webhook calls serialize.
    const [order] = await tx
      .select({
        id: orders.id,
        status: orders.status,
        paymentStatus: orders.paymentStatus,
        paymentMethod: orders.paymentMethod,
        reservationExpiresAt: orders.reservationExpiresAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update")
      .limit(1);

    // Only release stock for an expired, unpaid pending order.
    if (
      !order ||
      order.status !== "pending" ||
      order.paymentMethod !== "online" ||
      !["pending", "failed"].includes(order.paymentStatus) ||
      !order.reservationExpiresAt ||
      order.reservationExpiresAt >= new Date()
    ) {
      return false;
    }

    const items = await tx
      .select({
        listingId: orderItems.listingId,
        id: orderItems.id,
        quantity: orderItems.quantity,
        stockRestored: orderItems.stockRestored,
      })
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    // An order without items should not be marked as successfully released.
    if (items.length === 0) {
      throw new Error(
        `Cannot release reservation for order ${orderId}: no order items found`
      );
    }

    // Restore each vendor listing's reserved stock.
    for (const item of items) {
      if (item.stockRestored) continue;

      const [updatedListing] = await tx
        .update(vendorProductSchema)
        .set({
          stock: sql`${vendorProductSchema.stock} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(vendorProductSchema.id, item.listingId))
        .returning({ id: vendorProductSchema.id });

      // Throwing rolls back all stock updates and the order status change.
      if (!updatedListing) {
        throw new Error(
          `Vendor listing ${item.listingId} not found while releasing order ${orderId}`
        );
      }

      await tx
        .update(orderItems)
        .set({ stockRestored: true })
        .where(eq(orderItems.id, item.id));
    }

    // Mark the order as expired/failed in the same transaction.
    const [updatedOrder] = await tx
      .update(orders)
      .set({
        status: "cancelled",
        paymentStatus: "failed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "pending"),
          eq(orders.paymentMethod, "online"),
          inArray(orders.paymentStatus, ["pending", "failed"]),
          lt(orders.reservationExpiresAt, new Date())
        )
      )
      .returning({ id: orders.id });

    if (!updatedOrder) {
      // Roll back stock restoration if the order no longer qualifies.
      throw new Error(
        `Order ${orderId} changed while releasing its reservation`
      );
    }

    return true;
  });
}
