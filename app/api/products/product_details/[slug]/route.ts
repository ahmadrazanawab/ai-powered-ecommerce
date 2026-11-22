// FILE: app/api/products/product_details/[slug]/route.ts
// GET: one product (by slug) + all approved vendor offers for it

import { NextRequest, NextResponse } from "next/server";
import { db } from "../../../lib/db";
import { productSchema } from "../../../lib/schema/product-schema";
import { categorySchema } from "../../../lib/schema/category-schema";
import { and, eq, asc } from "drizzle-orm";
import { vendors } from "../../../lib/schema/vendor";
import { vendorProductSchema } from "../../../lib/schema/vendor-product-schema";
import { effectiveDescription } from "@/app/api/lib/schema/resolve-description";
import {
    getProductImageGroups,
    getResolvedProductImages,
} from "@/app/api/lib/product-image-queries";
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> } // Next.js 15: params is a Promise
) {
    try {
        const { slug } = await params;

        // 1. The admin product
        const [product] = await db
            .select({
                productId: productSchema.id,
                name: productSchema.name,
                slug: productSchema.slug,
                description: productSchema.description,
                imageUrl: productSchema.imageUrl,
                categoryId: categorySchema.id,
                categoryName: categorySchema.name,
                price: productSchema.price,
                stock: productSchema.stock,
                createdAt: productSchema.createdAt,
            })
            .from(productSchema)
            .innerJoin(
                categorySchema,
                eq(productSchema.categoryId, categorySchema.id)
            )
            .where(and(eq(productSchema.slug, slug), eq(productSchema.isActive, true)))
            .limit(1);

        if (!product) {
            return NextResponse.json(
                { success: false, message: "Product not found" },
                { status: 404 }
            );
        }

        const offers = await db
            .select({
                listingId: vendorProductSchema.id,
                vendorId: vendors.id,
                vendorName: vendors.name,
                price: vendorProductSchema.price,
                stock: vendorProductSchema.stock,
                description: effectiveDescription,   // ADD
            })
            .from(vendorProductSchema)
            .innerJoin(
                productSchema,                        // ADD
                eq(vendorProductSchema.productId, productSchema.id)
            )
            .innerJoin(vendors, eq(vendorProductSchema.vendorId, vendors.id))
            .where(
                and(
                    eq(vendorProductSchema.productId, product.productId),
                    eq(vendorProductSchema.isActive, true),
                    eq(vendors.status, "approved"),
                    eq(vendors.isActive, true)
                )
            )
            .orderBy(asc(vendorProductSchema.price));

        // 2. Approved vendor offers for this product (cheapest first)
        // const offers = await db
        //     .select({
        //         listingId: vendorProductSchema.id,
        //         vendorId: vendors.id,
        //         vendorName: vendors.name,
        //         price: vendorProductSchema.price,
        //         stock: vendorProductSchema.stock,
        //     })
        //     .from(vendorProductSchema)
        //     .innerJoin(vendors, eq(vendorProductSchema.vendorId, vendors.id))
        //     .where(
        //         and(
        //             eq(vendorProductSchema.productId, product.productId),
        //             eq(vendorProductSchema.isActive, true),
        //             eq(vendors.status, "approved"),
        //             eq(vendors.isActive, true)
        //         )
        //     )
        //     .orderBy(asc(vendorProductSchema.price));

        const imageGroups = await getProductImageGroups(
        [product.productId],
        offers.map((offer) => offer.listingId)
        );
        const productImages = getResolvedProductImages(
        imageGroups,
        product.productId,
        null,
        product.imageUrl
        );
        const offersWithImages = offers.map((offer) => {
        const images = getResolvedProductImages(
            imageGroups,
            product.productId,
            offer.listingId,
            product.imageUrl
        );

        return {
            ...offer,
            images,
            imageUrl: images[0]?.url ?? null,
        };
        });

        return NextResponse.json(
            {
                success: true,
                message: "Product fetched successfully",
            data: {
                ...product,
                images: productImages,
                imageUrl: productImages[0]?.url ?? null,
                offers: offersWithImages,
            },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_PRODUCT_BY_SLUG_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch product" },
            { status: 500 }
        );
    }
}