
// path : app/api/wishlist/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { eq, desc, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { wishlistItems } from "@/app/api/lib/schema/wishlist-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";

// GET: Fetch logged-in user's wishlist
export async function GET(request: NextRequest) {
    try {
        // 1. Authentication
        const token = (await cookies()).get("user_token")?.value;

        if (!token) {
            return NextResponse.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            );
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            return NextResponse.json(
                { success: false, message: "Server configuration error" },
                { status: 500 }
            );
        }

        let userId: string;

        try {
            const { payload } = await jwtVerify(
                token,
                new TextEncoder().encode(secret),
                { algorithms: ["HS256"] }
            );

            if (
                typeof payload.userId !== "string" ||
                payload.role !== "USER"
            ) {
                return NextResponse.json(
                    { success: false, message: "Invalid authentication token" },
                    { status: 401 }
                );
            }

            userId = payload.userId;
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid or expired token" },
                { status: 401 }
            );
        }

        // 2. Verify customer account
        const [user] = await db
            .select({
                id: users.id,
                isBlocked: users.isBlocked,
                deletedAt: users.deletedAt,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user || user.deletedAt) {
            return NextResponse.json(
                { success: false, message: "Account not found" },
                { status: 401 }
            );
        }

        if (user.isBlocked) {
            return NextResponse.json(
                { success: false, message: "Your account has been blocked" },
                { status: 403 }
            );
        }

        // 3. Fetch wishlist with product, listing and vendor details
        const items = await db
            .select({
                wishlistItemId: wishlistItems.id,
                listingId: vendorProductSchema.id,
                available: sql<boolean>`
                (
                    ${vendorProductSchema.isActive} = true
                    AND ${productSchema.isActive} = true
                    AND ${vendors.isActive} = true
                    AND ${vendors.status} = 'approved'
                )`,
               
                productId: productSchema.id,
                name: productSchema.name,
                slug: productSchema.slug,
                description: productSchema.description,
                imageUrl: productSchema.imageUrl,

                vendorId: vendors.id,
                vendorName: vendors.name,

                price: vendorProductSchema.price,
                stock: vendorProductSchema.stock,

                addedAt: wishlistItems.createdAt,
            })
            .from(wishlistItems)
            .innerJoin(
                vendorProductSchema,
                eq(wishlistItems.listingId, vendorProductSchema.id)
            )
            .innerJoin(
                productSchema,
                eq(vendorProductSchema.productId, productSchema.id)
            )
            .innerJoin(
                vendors,
                eq(vendorProductSchema.vendorId, vendors.id)
            )
            .where(eq(wishlistItems.userId, user.id))
            .orderBy(desc(wishlistItems.createdAt));

        // 4. Response
        return NextResponse.json({
            success: true,
            data: {
                items,
                totalItems: items.length,
            },
        });
    } catch (error) {
        console.error("GET WISHLIST ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch wishlist" },
            { status: 500 }
        );
    }
}