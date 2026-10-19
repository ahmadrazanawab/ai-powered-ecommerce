import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { orderItems, orders } from "@/app/api/lib/schema/checkout-schema";
import { verifyVendorToken } from "../verify-token-vendor";

export async function GET(request: Request) {
  try {
    const auth = await verifyVendorToken(request as never);
    if (!auth.success) return auth.response;

    const vendorId = auth.payload.vendorId;

    const data = await db
      .select({
        item: orderItems,
        order: orders,
      })
      .from(orderItems)
      .innerJoin(orders, eq(orders.id, orderItems.orderId))
      .where(eq(orderItems.vendorId, vendorId))
      .orderBy(desc(orderItems.createdAt));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("VENDOR_ORDERS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch vendor orders" },
      { status: 500 }
    );
  }
}