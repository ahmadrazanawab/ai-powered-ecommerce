
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { productSchema } from "@/app/api/lib/schema/product-schema";
// get all products
export async function GET() {
    try {
        const products = await db
            .select({
                id: productSchema.id,
                name: productSchema.name,
                slug: productSchema.slug,
                sku: productSchema.sku,
                description: productSchema.description,
                categoryId: productSchema.categoryId,
                imageUrl: productSchema.imageUrl,
            })
            .from(productSchema)
            .where(eq(productSchema.isActive, true));

        return NextResponse.json({
            success: true,
            data: products,
        });
    } catch (error) {
        console.error("GET_CATALOG_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch catalog" },
            { status: 500 }
        );
    }
}
