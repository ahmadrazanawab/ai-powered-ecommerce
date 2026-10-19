import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { orders } from "@/app/api/lib/schema/checkout-schema";
import { verifyAdminToken } from "../verify-token";

const orderStatuses = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;

const paymentStatuses = [
  "pending",
  "processing",
  "paid",
  "succeeded",
  "failed",
  "refunded",
  "cancelled",
] as const;

export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAdminToken(request);
    if (!auth.success) return auth.response;

    if (!["admin", "super_admin"].includes(auth.payload.role)) {
      return NextResponse.json(
        { success: false, message: "Forbidden" },
        { status: 403 }
      );
    }

    const params = request.nextUrl.searchParams;
    const status = params.get("status");
    const paymentStatus = params.get("paymentStatus");

    if (
      status &&
      !orderStatuses.includes(status as (typeof orderStatuses)[number])
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid order status" },
        { status: 400 }
      );
    }

    if (
      paymentStatus &&
      !paymentStatuses.includes(
        paymentStatus as (typeof paymentStatuses)[number]
      )
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid payment status" },
        { status: 400 }
      );
    }

    const filters = [];

    if (status) {
      filters.push(
        eq(orders.status, status as (typeof orderStatuses)[number])
      );
    }

    if (paymentStatus) {
      filters.push(
        eq(
          orders.paymentStatus,
          paymentStatus as (typeof paymentStatuses)[number]
        )
      );
    }

    const data = await db
      .select()
      .from(orders)
      .where(filters.length ? and(...filters) : undefined)
      .orderBy(desc(orders.createdAt))
      .limit(100);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("ADMIN_GET_ORDERS_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}