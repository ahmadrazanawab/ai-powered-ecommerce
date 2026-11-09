

// path : app/api/wishlist/items/[wishlistItemId]/route.ts

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { jwtVerify } from "jose";
import { eq, and } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { wishlistItems } from "@/app/api/lib/schema/wishlist-schema";

const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// DELETE: Remove wishlist item
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ wishlistItemId: string }> }
) {
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

        // 3. Get wishlist item ID
        const { wishlistItemId } = await params;

        if (!UUID_REGEX.test(wishlistItemId)) {
            return NextResponse.json(
                { success: false, message: "Invalid wishlist item ID" },
                { status: 400 }
            );
        }

        // 4. Delete only the logged-in user's wishlist item
        const [deletedItem] = await db
            .delete(wishlistItems)
            .where(
                and(
                    eq(wishlistItems.id, wishlistItemId),
                    eq(wishlistItems.userId, user.id)
                )
            )
            .returning({
                id: wishlistItems.id,
                listingId: wishlistItems.listingId,
            });

        if (!deletedItem) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Wishlist item not found",
                },
                { status: 404 }
            );
        }

        // 5. Response
        return NextResponse.json({
            success: true,
            message: "Product removed from wishlist successfully",
            data: {
                wishlistItemId: deletedItem.id,
                listingId: deletedItem.listingId,
            },
        });
    } catch (error) {
        console.error("DELETE WISHLIST ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to remove wishlist item" },
            { status: 500 }
        );
    }
}