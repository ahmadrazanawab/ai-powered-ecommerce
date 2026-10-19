import { NextRequest, NextResponse } from "next/server";
import { and, eq, lt } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { orders } from "@/app/api/lib/schema/checkout-schema";
import { releaseExpiredReservation } from "../../lib/release-expired-reservation";

export async function POST(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const supplied = request.headers.get("authorization");

  if (!expected || supplied !== `Bearer ${expected}`) {
    return NextResponse.json({ success: false }, { status: 401 });
  }

  const expired = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        lt(orders.reservationExpiresAt, new Date())
      )
    )
    .limit(100);

  let released = 0;

  for (const order of expired) {
    if (await releaseExpiredReservation(order.id)) released++;
  }

  return NextResponse.json({ success: true, released });
}