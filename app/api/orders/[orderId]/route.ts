// file : app/api/orders/[orderId]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { and, eq, getTableColumns } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import {
    orders,
    orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { requireCustomer } from "@/app/api/lib/customer-auth";
import { productSchema } from "../../lib/schema/product-schema";



export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ orderId: string }> }
) {
    try {
        const auth = await requireCustomer();
        if (!auth.customerId) return auth.response;

        const { orderId } = await params;

        const [order] = await db
            .select()
            .from(orders)
            .where(
                and(
                    eq(orders.id, orderId),
                    eq(orders.userId, auth.customerId)
                )
            )
            .limit(1);

        if (!order) {
            return NextResponse.json(
                { success: false, message: "Order not found" },
                { status: 404 }
            );
        }


        const items = await db
            .select({
                ...getTableColumns(orderItems),
                imageUrl: productSchema.imageUrl,
            })
            .from(orderItems)
            .leftJoin(productSchema, eq(orderItems.productId, productSchema.id))
            .where(eq(orderItems.orderId, order.id));

        return NextResponse.json({
            success: true,
            data: { ...order, items },
        });
    } catch (error) {
        console.error("GET_ORDER_ERROR", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch order" },
            { status: 500 }
        );
    }
}