import { NextRequest, NextResponse } from "next/server";
import { desc, eq, and } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
    orderItems,
    orders,
} from "@/app/api/lib/schema/checkout-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { verifyVendorToken } from "../verify-token-vendor";

export async function GET(request: NextRequest) {
    try {
        const auth = await verifyVendorToken(request);
        if (!auth.success) return auth.response;

        const [vendor] = await db
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

        if (!vendor) {
            return NextResponse.json(
                { success: false, message: "Vendor account is inactive or unapproved" },
                { status: 403 }
            );
        }

        const data = await db
            .select({
                item: orderItems,
                order: orders,
            })
            .from(orderItems)
            .innerJoin(orders, eq(orders.id, orderItems.orderId))
            .where(eq(orderItems.vendorId, vendor.id))
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

