import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { verifyVendorToken } from "../verify-token-vendor";
import { effectiveDescription } from "@/app/api/lib/schema/resolve-description"; // ADD
import {
    getProductImageGroups,
    getResolvedProductImages,
} from "@/app/api/lib/product-image-queries";
import { productImages } from "@/app/api/lib/schema/product-image-schema";
import {
    buildProductImageRows,
    deleteCloudinaryImages,
    getProductImageFiles,
    prepareProductImageManifest,
    ProductImageStorageError,
    ProductImageValidationError,
    uploadProductImageFiles,
} from "@/app/api/lib/product-image-storage";

export const runtime = "nodejs";

// POST: Vendor lists an existing catalog product
export async function POST(req: NextRequest) {
    let uploadedImages: Awaited<
        ReturnType<typeof uploadProductImageFiles>
    > = [];
    let transactionCompleted = false;

    try {
        const auth = await verifyVendorToken(req);

        if (!auth.success) {
            return auth.response;
        }

        const vendorId = auth.payload.vendorId;

        // Verify the vendor is currently approved and active
        const [vendor] = await db
            .select({
                id: vendors.id,
            })
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

        let body: Record<string, unknown>;
        let formData: FormData | null = null;
        let files: File[] = [];

        if (req.headers.get("content-type")?.includes("multipart/form-data")) {
            formData = await req.formData();
            const activeValue = formData.get("isActive");
            body = {
                productId: formData.get("productId"),
                price: formData.get("price"),
                stock: formData.get("stock"),
                description: formData.get("description"),
                ...(activeValue === null
                    ? {}
                    : { isActive: activeValue === "true" }),
            };
            files = getProductImageFiles(formData);
        } else {
            const json: unknown = await req.json();

            if (
                typeof json !== "object" ||
                json === null ||
                Array.isArray(json)
            ) {
                return NextResponse.json(
                    { success: false, message: "Request body must be an object" },
                    { status: 400 }
                );
            }

            body = json as Record<string, unknown>;
        }

        const productId = typeof body.productId === "string" ? body.productId : "";
        const price = body.price;
        const stock = body.stock;

        if (
            !productId ||
            price === undefined ||
            price === null ||
            !Number.isFinite(Number(price)) ||
            Number(price) < 0 ||
            stock === undefined ||
            !Number.isInteger(Number(stock)) ||
            Number(stock) < 0
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Valid productId, non-negative price, and stock are required",
                },
                { status: 400 }
            );
        }

        // ADD: optional vendor description (trimmed, empty becomes null)
        const rawDescription = body.description;

        if (
            rawDescription !== undefined &&
            rawDescription !== null &&
            typeof rawDescription !== "string"
        ) {
            return NextResponse.json(
                { success: false, message: "Description must be a string" },
                { status: 400 }
            );
        }

        const trimmedDescription =
            typeof rawDescription === "string" ? rawDescription.trim() : "";

        if (trimmedDescription.length > 5000) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Description must be 5000 characters or less",
                },
                { status: 400 }
            );
        }

        const description = trimmedDescription === "" ? null : trimmedDescription;

        // Ensure the catalog product exists and is active
        const [product] = await db
            .select({ id: productSchema.id })
            .from(productSchema)
            .where(
                and(
                    eq(productSchema.id, productId),
                    eq(productSchema.isActive, true)
                )
            )
            .limit(1);

        if (!product) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Catalog product not found or inactive",
                },
                { status: 404 }
            );
        }

        // Create the vendor's offer; do not create a catalog product here
        const manifest = formData
            ? prepareProductImageManifest(formData, files, [])
            : [];
        uploadedImages =
            files.length > 0
                ? await uploadProductImageFiles(
                      files,
                      `aiecommerce/vendor-products/${vendorId}/${productId}`
                  )
                : [];

        const listing = await db.transaction(async (tx) => {
            const [createdListing] = await tx
                .insert(vendorProductSchema)
                .values({
                    vendorId,
                    productId,
                    price: String(price),
                    stock: Number(stock),
                    description,
                    isActive:
                        body.isActive === undefined
                            ? true
                            : body.isActive === true,
                })
                .returning();

            if (uploadedImages.length > 0) {
                const imageRows = buildProductImageRows(
                    {
                        source: "vendor",
                        vendorProductId: createdListing.id,
                    },
                    manifest,
                    [],
                    uploadedImages
                ).images;

                await tx.insert(productImages).values(imageRows);
            }

            return createdListing;
        });
        transactionCompleted = true;

        return NextResponse.json(
            {
                success: true,
                message: "Product listed successfully",
                data: listing,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE_VENDOR_LISTING_ERROR:", error);

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

        const dbError = error as { code?: string };

        if (dbError.code === "23505") {
            return NextResponse.json(
                {
                    success: false,
                    message: "You have already listed this product",
                },
                { status: 409 }
            );
        }

        if (dbError.code === "22P02") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid product ID",
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to list product",
            },
            { status: 500 }
        );
    }
}

// GET: Customers see active offers from approved vendors
export async function GET() {
    try {
        const products = await db
            .select({
                listingId: vendorProductSchema.id,
                productId: productSchema.id,
                categoryId: productSchema.categoryId,
                categoryName: categorySchema.name,
                name: productSchema.name,
                slug: productSchema.slug,
                sku: productSchema.sku,
                description: effectiveDescription, // CHANGED: vendor's, else admin's
                imageUrl: productSchema.imageUrl,
                price: vendorProductSchema.price,
                stock: vendorProductSchema.stock,
                vendorId: vendors.id,
                vendorName: vendors.name,
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
            .innerJoin(
                categorySchema,
                eq(productSchema.categoryId, categorySchema.id)
            )
            .where(
                and(
                    eq(productSchema.isActive, true),
                    eq(vendorProductSchema.isActive, true),
                    eq(vendors.status, "approved"),
                    eq(vendors.isActive, true)
                )
            );

        const imageGroups = await getProductImageGroups(
            products.map((product) => product.productId),
            products.map((product) => product.listingId)
        );
        const productsWithImages = products.map((product) => {
            const images = getResolvedProductImages(
                imageGroups,
                product.productId,
                product.listingId,
                product.imageUrl
            );

            return {
                ...product,
                images,
                imageUrl: images[0]?.url ?? null,
            };
        });

        return NextResponse.json(
            {
                success: true,
                message: "Products fetched successfully",
                data: productsWithImages,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_PRODUCTS_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch products",
            },
            { status: 500 }
        );
    }
}

