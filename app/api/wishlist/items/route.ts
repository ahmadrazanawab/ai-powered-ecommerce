// path : app/api/wishlist/items/route.ts


import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { eq, and } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { wishlistItems } from "@/app/api/lib/schema/wishlist-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST: Add listing to wishlist
export async function POST(request: NextRequest) {
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

        // 3. Validate request body
        const body = await request.json().catch(() => null);
        const listingId = body?.listingId;

        if (
            typeof listingId !== "string" ||
            !UUID_REGEX.test(listingId)
        ) {
            return NextResponse.json(
                { success: false, message: "Valid listingId is required" },
                { status: 400 }
            );
        }

        // 4. Verify vendor listing, product and vendor
        const [listing] = await db
            .select({
                id: vendorProductSchema.id,
                isActive: vendorProductSchema.isActive,
                stock: vendorProductSchema.stock,

                productActive: productSchema.isActive,

                vendorActive: vendors.isActive,
                vendorStatus: vendors.status,
            })
            .from(vendorProductSchema)
            .innerJoin(
                productSchema,
                eq(vendorProductSchema.productId, productSchema.id)
            )
            .innerJoin(
                vendors,
                eq(vendorProductSchema.vendorId, vendors.id)
            )
            .where(eq(vendorProductSchema.id, listingId))
            .limit(1);

        if (!listing) {
            return NextResponse.json(
                { success: false, message: "Product listing not found" },
                { status: 404 }
            );
        }

        if (
            !listing.isActive ||
            !listing.productActive ||
            !listing.vendorActive ||
            listing.vendorStatus !== "approved" ||
            listing.stock <= 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "This product is currently unavailable",
                },
                { status: 400 }
            );
        }

        // 5. Check duplicate wishlist entry
        const [existingItem] = await db
            .select({
                id: wishlistItems.id,
            })
            .from(wishlistItems)
            .where(
                and(
                    eq(wishlistItems.userId, user.id),
                    eq(wishlistItems.listingId, listingId)
                )
            )
            .limit(1);

        if (existingItem) {
            return NextResponse.json({
                success: true,
                message: "Product is already in your wishlist",
                data: {
                    wishlistItemId: existingItem.id,
                    listingId,
                },
            });
        }

        // 6. Insert wishlist item
        // onConflictDoNothing also handles simultaneous duplicate requests.
        const [newItem] = await db
            .insert(wishlistItems)
            .values({
                userId: user.id,
                listingId,
            })
            .onConflictDoNothing({
                target: [wishlistItems.userId, wishlistItems.listingId],
            })
            .returning({
                id: wishlistItems.id,
                listingId: wishlistItems.listingId,
            });

        if (!newItem) {
            // Another request may have inserted the same item concurrently.
            const [existing] = await db
                .select({
                    id: wishlistItems.id,
                    listingId: wishlistItems.listingId,
                })
                .from(wishlistItems)
                .where(
                    and(
                        eq(wishlistItems.userId, user.id),
                        eq(wishlistItems.listingId, listingId)
                    )
                )
                .limit(1);

            if (!existing) {
                throw new Error("Wishlist item could not be created");
            }

            return NextResponse.json({
                success: true,
                message: "Product is already in your wishlist",
                data: {
                    wishlistItemId: existing.id,
                    listingId: existing.listingId,
                },
            });
        }

        // 7. Response
        return NextResponse.json(
            {
                success: true,
                message: "Product added to wishlist successfully",
                data: {
                    wishlistItemId: newItem.id,
                    listingId: newItem.listingId,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("ADD WISHLIST ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to add product to wishlist" },
            { status: 500 }
        );
    }
}