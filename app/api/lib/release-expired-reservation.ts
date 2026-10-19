
import { and, eq, lt, sql } from "drizzle-orm";

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
        reservationExpiresAt: orders.reservationExpiresAt,
      })
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update")
      .limit(1);

    // Only release stock for an expired, unpaid pending order.
    if (
      !order ||
      order.status !== "pending_payment" ||
      order.paymentStatus !== "pending" ||
      order.reservationExpiresAt >= new Date()
    ) {
      return false;
    }

    const items = await tx
      .select({
        listingId: orderItems.listingId,
        quantity: orderItems.quantity,
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
    }

    // Mark the order as expired/failed in the same transaction.
    const [updatedOrder] = await tx
      .update(orders)
      .set({
        status: "payment_failed",
        paymentStatus: "failed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "pending_payment"),
          eq(orders.paymentStatus, "pending"),
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
