import { and, eq, sql } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { db } from "@/app/api/lib/db";
import {
  orders,
  orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function restoreItemStock(
  tx: Tx,
  itemId: string
): Promise<boolean> {
  const [item] = await tx
    .update(orderItems)
    .set({ stockRestored: true })
    .where(
      and(
        eq(orderItems.id, itemId),
        eq(orderItems.stockRestored, false)
      )
    )
    .returning({
      id: orderItems.id,
      listingId: orderItems.listingId,
      quantity: orderItems.quantity,
    });

  if (!item) return false;

  const [listing] = await tx
    .update(vendorProductSchema)
    .set({
      stock: sql`${vendorProductSchema.stock} + ${item.quantity}`,
      updatedAt: new Date(),
    })
    .where(eq(vendorProductSchema.id, item.listingId))
    .returning({ id: vendorProductSchema.id });

  if (!listing) {
    throw new Error(`LISTING_NOT_FOUND:${item.listingId}`);
  }

  return true;
}

export async function refreshOrderStatus(
  tx: Tx,
  orderId: string
) {
  const items = await tx
    .select({
      status: orderItems.fulfillmentStatus,
    })
    .from(orderItems)
    .where(eq(orderItems.orderId, orderId));

  if (items.length === 0) return;

  const statuses = items.map((item) => item.status);

  let status: typeof orders.$inferSelect.status;

  if (statuses.every((s) => s === "cancelled")) {
    status = "cancelled";
  } else if (
    statuses.every((s) => s === "delivered" || s === "cancelled")
  ) {
    status = "delivered";
  } else if (statuses.some((s) => s === "shipped")) {
    status = "shipped";
  } else if (statuses.some((s) => s === "processing")) {
    status = "processing";
  } else {
    status = "confirmed";
  }

  await tx
    .update(orders)
    .set({ status, updatedAt: new Date() })
    .where(eq(orders.id, orderId));
}