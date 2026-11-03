
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { verifyVendorToken } from "../../verify-token-vendor";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ listingId: string }>;
};

export async function PUT(
    req: NextRequest,
    context: RouteContext
) {
    try {
        // 1. Authenticate vendor
        const auth = await verifyVendorToken(req);

        if (!auth.success) {
            return auth.response;
        }

        const vendorId = auth.payload.vendorId;
        const { listingId } = await context.params;

        // 2. Validate listing ID format
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(listingId)) {
            return NextResponse.json(
                { success: false, message: "Invalid listing ID" },
                { status: 400 }
            );
        }

        // 3. Confirm vendor is approved and active
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

        // 4. Parse request body
        let body: unknown;

        try {
            body = await req.json();
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid JSON body" },
                { status: 400 }
            );
        }

        if (
            typeof body !== "object" ||
            body === null ||
            Array.isArray(body)
        ) {
            return NextResponse.json(
                { success: false, message: "Request body must be a JSON object" },
                { status: 400 }
            );
        }

        const input = body as Record<string, unknown>;
        const allowedFields = ["price", "stock", "isActive"];

        // Reject unexpected fields such as vendorId or productId
        if (Object.keys(input).some((key) => !allowedFields.includes(key))) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Only price, stock, and isActive can be updated",
                },
                { status: 400 }
            );
        }

        if (Object.keys(input).length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Provide at least one field to update",
                },
                { status: 400 }
            );
        }

        // 5. Validate and build partial update
        const updateData: {
            price?: string;
            stock?: number;
            isActive?: boolean;
            updatedAt: Date;
        } = {
            updatedAt: new Date(),
        };

        if (Object.hasOwn(input, "price")) {
            const rawPrice = input.price;

            if (
                !(
                    typeof rawPrice === "string" ||
                    typeof rawPrice === "number"
                ) ||
                (typeof rawPrice === "string" && rawPrice.trim() === "")
            ) {
                return NextResponse.json(
                    { success: false, message: "Price must be a valid number" },
                    { status: 400 }
                );
            }

            const price = Number(rawPrice);

            if (
                !Number.isFinite(price) ||
                price < 0 ||
                !/^\d+(\.\d{1,2})?$/.test(String(rawPrice).trim())
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Price must be non-negative with at most 2 decimal places",
                    },
                    { status: 400 }
                );
            }

            updateData.price = price.toFixed(2);
        }

        if (Object.hasOwn(input, "stock")) {
            if (
                typeof input.stock !== "number" ||
                !Number.isInteger(input.stock) ||
                input.stock < 0
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Stock must be a non-negative integer",
                    },
                    { status: 400 }
                );
            }

            updateData.stock = input.stock;
        }

        if (Object.hasOwn(input, "isActive")) {
            if (typeof input.isActive !== "boolean") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "isActive must be true or false",
                    },
                    { status: 400 }
                );
            }

            updateData.isActive = input.isActive;
        }

        // 6. Update only a listing owned by this vendor
        const [updatedListing] = await db
            .update(vendorProductSchema)
            .set(updateData)
            .where(
                and(
                    eq(vendorProductSchema.id, listingId),
                    eq(vendorProductSchema.vendorId, vendorId)
                )
            )
            .returning();

        if (!updatedListing) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Listing not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Listing updated successfully",
                data: updatedListing,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("UPDATE_VENDOR_PRODUCT_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update listing",
            },
            { status: 500 }
        );
    }
}



// ADD THIS to the same file as your PUT:
// app/api/auth/vendor/products/[listingId]/route.ts
const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function DELETE(
    req: NextRequest,
    context: RouteContext
) {
    try {
        // 1. Authenticate vendor
        const auth = await verifyVendorToken(req);

        if (!auth.success) {
            return auth.response;
        }

        const vendorId = auth.payload.vendorId;
        const { listingId } = await context.params;

        // 2. Validate listing ID format
        if (!UUID_REGEX.test(listingId)) {
            return NextResponse.json(
                { success: false, message: "Invalid listing ID" },
                { status: 400 }
            );
        }

        // 3. Confirm vendor is approved and active
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

        // 4. Delete only a listing owned by this vendor
        const [deletedListing] = await db
            .delete(vendorProductSchema)
            .where(
                and(
                    eq(vendorProductSchema.id, listingId),
                    eq(vendorProductSchema.vendorId, vendorId)
                )
            )
            .returning({ id: vendorProductSchema.id });

        if (!deletedListing) {
            return NextResponse.json(
                { success: false, message: "Listing not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Listing deleted successfully",
                data: { listingId: deletedListing.id },
            },
            { status: 200 }
        );
    } catch (error) {
        // 23503 = Postgres foreign key violation (the listing is used by orders or cart items)
        const err = error as { code?: string; cause?: { code?: string } };
        const code = err?.code ?? err?.cause?.code;

        if (code === "23503") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "This listing is linked to existing orders and cannot be deleted. Hide it instead.",
                },
                { status: 409 }
            );
        }

        console.error("DELETE_VENDOR_PRODUCT_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to delete listing",
            },
            { status: 500 }
        );
    }
}