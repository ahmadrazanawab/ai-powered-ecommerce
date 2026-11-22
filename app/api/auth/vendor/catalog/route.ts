// file path : app/vendor/catalog/route.ts
import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import {
    getProductImageGroups,
    getResolvedProductImages,
} from "@/app/api/lib/product-image-queries";
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

        const imageGroups = await getProductImageGroups(
            products.map((product) => product.id),
            []
        );
        const productsWithImages = products.map((product) => {
            const images = getResolvedProductImages(
                imageGroups,
                product.id,
                null,
                product.imageUrl
            );

            return {
                ...product,
                images,
                imageUrl: images[0]?.url ?? null,
            };
        });

        return NextResponse.json({
            success: true,
            data: productsWithImages,
        });
    } catch (error) {
        console.error("GET_CATALOG_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch catalog" },
            { status: 500 }
        );
    }
}
