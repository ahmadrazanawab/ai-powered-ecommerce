// file path : app/api/cron/expire-checkouts/route.ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq, inArray, lt } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { orders } from "@/app/api/lib/schema/checkout-schema";
import { releaseExpiredReservation } from "../../lib/release-expired-reservation";
import { reconcileRazorpayOrder } from "@/app/api/lib/razorpay-orders";

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization");

  if (!expected || supplied !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const expired = await db
    .select({
      id: orders.id,
      razorpayOrderId: orders.razorpayOrderId,
    })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        eq(orders.paymentMethod, "online"),
        inArray(orders.paymentStatus, ["pending", "failed"]),
        lt(orders.reservationExpiresAt, new Date())
      )
    )
    .limit(100);

  let released = 0;

  for (const order of expired) {
    try {
      if (order.razorpayOrderId && await reconcileRazorpayOrder(order.id)) {
        continue;
      }
    } catch (error) {
      console.error("RAZORPAY_EXPIRY_RECONCILIATION_ERROR", error);
      continue;
    }

    if (await releaseExpiredReservation(order.id)) released++;
  }

  return NextResponse.json({ success: true, released });
}