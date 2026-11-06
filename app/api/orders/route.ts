// file : app/api/orders/route.ts
import { NextResponse } from "next/server";
import { desc, eq, getTableColumns, inArray } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { orders, orderItems } from "@/app/api/lib/schema/checkout-schema";
import { productSchema } from "@/app/api/lib/schema/product-schema"; // CHANGED: new import
import { requireCustomer } from "@/app/api/lib/customer-auth";

export async function GET() {
    try {
        const auth = await requireCustomer();
        if (!auth.customerId) return auth.response;

        const rows = await db
            .select()
            .from(orders)
            .where(eq(orders.userId, auth.customerId))
            .orderBy(desc(orders.createdAt));

        // CHANGED: left join products so each item carries its image.
        // leftJoin keeps the item even if the product was deleted later.
        const items =
            rows.length === 0
                ? []
                : await db
                    .select({
                        ...getTableColumns(orderItems),
                        imageUrl: productSchema.imageUrl,
                    })
                    .from(orderItems)
                    .leftJoin(productSchema, eq(orderItems.productId, productSchema.id))
                    .where(inArray(orderItems.orderId, rows.map((o) => o.id)));

        const data = rows.map((order) => ({
            ...order,
            items: items.filter((item) => item.orderId === order.id),
        }));

        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("GET_ORDERS_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch orders" },
            { status: 500 }
        );
    }
}