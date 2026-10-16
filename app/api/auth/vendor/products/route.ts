
import { NextRequest, NextResponse } from "next/server";
import { and, eq, desc } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { verifyVendorToken } from "../verify-token-vendor";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
    try {
        // 1. Authenticate vendor
        const auth = await verifyVendorToken(req);

        if (!auth.success) {
            return auth.response;
        }

        const vendorId = auth.payload.vendorId;

        // 2. Confirm vendor is approved and active
        const [vendor] = await db
            .select({ id: vendors.id })
            .from(vendors)
            .where(
                and(
                    eq(vendors.id, vendorId),
                    eq(vendors.status, "approved"),
                    eq(vendors.isActive, true)
                )
            )
            .limit(1);

        if (!vendor) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Your vendor account is not approved or active",
                },
                { status: 403 }
            );
        }

        // 3. Fetch only this vendor's listings
        const listings = await db
            .select({
                listingId: vendorProductSchema.id,
                productId: productSchema.id,
                categoryId: productSchema.categoryId,
                categoryName: categorySchema.name,
                name: productSchema.name,
                slug: productSchema.slug,
                sku: productSchema.sku,
                description: productSchema.description,
                imageUrl: productSchema.imageUrl,

                // Vendor-specific information
                price: vendorProductSchema.price,
                stock: vendorProductSchema.stock,
                isActive: vendorProductSchema.isActive,
                createdAt: vendorProductSchema.createdAt,
                updatedAt: vendorProductSchema.updatedAt,
            })
            .from(vendorProductSchema)
            .innerJoin(
                productSchema,
                eq(vendorProductSchema.productId, productSchema.id)
            )
            .innerJoin(
                categorySchema,
                eq(productSchema.categoryId, categorySchema.id)
            )
            .where(eq(vendorProductSchema.vendorId, vendorId))
            .orderBy(desc(vendorProductSchema.createdAt));

        return NextResponse.json(
            {
                success: true,
                message: "Your listings fetched successfully",
                data: listings,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_VENDOR_PRODUCTS_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch your listings",
            },
            { status: 500 }
        );
    }
}
