import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { orders } from "@/app/api/lib/schema/checkout-schema";
import { requireCustomer } from "@/app/api/lib/customer-auth";

export async function GET() {
  try {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response;

    const data = await db
      .select()
      .from(orders)
      .where(eq(orders.userId, auth.customerId))
      .orderBy(desc(orders.createdAt));

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("GET_ORDERS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}