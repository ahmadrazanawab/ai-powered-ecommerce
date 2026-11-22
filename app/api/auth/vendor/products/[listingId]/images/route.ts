import { NextRequest, NextResponse } from "next/server";
import { and, asc, desc, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
    buildProductImageRows,
    cleanupOrphanedProductImages,
    deleteCloudinaryImages,
    getProductImageFiles,
    prepareProductImageManifest,
    ProductImageStorageError,
    ProductImageValidationError,
    uploadProductImageFiles,
} from "@/app/api/lib/product-image-storage";
import { productImages } from "@/app/api/lib/schema/product-image-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { verifyVendorToken } from "../../../verify-token-vendor";

export const runtime = "nodejs";

type RouteContext = {
    params: Promise<{ listingId: string }>;
};

const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PUT(req: NextRequest, context: RouteContext) {
    let uploadedImages: Awaited<
        ReturnType<typeof uploadProductImageFiles>
    > = [];
    let transactionCompleted = false;

    try {
        const auth = await verifyVendorToken(req);

        if (!auth.success) {
            return auth.response;
        }

        const { listingId } = await context.params;

        if (!uuidPattern.test(listingId)) {
            return NextResponse.json(
                { success: false, message: "Invalid listing ID" },
                { status: 400 }
            );
        }

        const vendorId = auth.payload.vendorId;
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

        const [listing] = await db
            .select({
                id: vendorProductSchema.id,
                productId: vendorProductSchema.productId,
            })
            .from(vendorProductSchema)
            .where(
                and(
                    eq(vendorProductSchema.id, listingId),
                    eq(vendorProductSchema.vendorId, vendorId)
                )
            )
            .limit(1);

        if (!listing) {
            return NextResponse.json(
                { success: false, message: "Listing not found" },
                { status: 404 }
            );
        }

        const formData = await req.formData();
        const files = getProductImageFiles(formData);
        const existingImages = await db
            .select({
                id: productImages.id,
                imageUrl: productImages.imageUrl,
                publicId: productImages.publicId,
                sortOrder: productImages.sortOrder,
                isPrimary: productImages.isPrimary,
            })
            .from(productImages)
            .where(
                and(
                    eq(productImages.vendorProductId, listing.id),
                    eq(productImages.source, "vendor")
                )
            )
            .orderBy(
                asc(productImages.sortOrder),
                desc(productImages.isPrimary)
            );
        const manifest = prepareProductImageManifest(
            formData,
            files,
            existingImages
        );

        if (files.length > 0) {
            uploadedImages = await uploadProductImageFiles(
                files,
                `aiecommerce/vendor-products/${vendorId}/${listing.productId}`
            );
        }

        const { images, removed } = buildProductImageRows(
            { source: "vendor", vendorProductId: listing.id },
            manifest,
            existingImages,
            uploadedImages
        );

        await db.transaction(async (tx) => {
            await tx
                .delete(productImages)
                .where(
                    and(
                        eq(productImages.vendorProductId, listing.id),
                        eq(productImages.source, "vendor")
                    )
                );

            if (images.length > 0) {
                await tx.insert(productImages).values(images);
            }
        });
        transactionCompleted = true;

        await cleanupOrphanedProductImages(removed);

        const savedImages = await db
            .select({
                id: productImages.id,
                url: productImages.imageUrl,
                sortOrder: productImages.sortOrder,
                isPrimary: productImages.isPrimary,
            })
            .from(productImages)
            .where(
                and(
                    eq(productImages.vendorProductId, listing.id),
                    eq(productImages.source, "vendor")
                )
            )
            .orderBy(
                asc(productImages.sortOrder),
                desc(productImages.isPrimary)
            );

        return NextResponse.json(
            {
                success: true,
                message: "Listing images updated successfully",
                data: savedImages,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("UPDATE_VENDOR_PRODUCT_IMAGES_ERROR:", error);

        if (uploadedImages.length > 0 && !transactionCompleted) {
            await deleteCloudinaryImages(uploadedImages);
        }

        if (error instanceof ProductImageValidationError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }

        if (error instanceof ProductImageStorageError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 502 }
            );
        }

        return NextResponse.json(
            { success: false, message: "Failed to update listing images" },
            { status: 500 }
        );
    }
}
