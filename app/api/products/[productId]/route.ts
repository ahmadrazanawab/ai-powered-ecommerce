import { NextResponse, NextRequest } from "next/server";
import { eq, and } from "drizzle-orm";

import { db } from "../../lib/db";
import { productSchema } from "../../lib/schema/product-schema";
import { productValidation } from "../../lib/validations/product-validation";
import { verifyAdminToken } from "../../auth/admin/verify-token";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        // 1. Authenticate admin
        const auth = await verifyAdminToken(req);

        if (!auth.success) {
            return auth.response;
        }

        // 2. Only admin and super_admin can update catalog products
        const allowedRoles = ["admin", "super_admin"];

        if (!allowedRoles.includes(auth.payload.role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "You do not have permission to update products",
                },
                { status: 403 }
            );
        }

        // 3. Get product ID
        const { productId } = await params;

        // 4. Read form data
        const formData = await req.formData();

        const isActiveValue =
            formData.get("isActive") ??
            formData.get("is_active");

        // 5. Validate fields
        const result = productValidation.safeParse({
            name: formData.get("name"),
            slug: formData.get("slug"),
            sku: formData.get("sku"),
            description: formData.get("description"),
            price: formData.get("price"),
            stock:
                formData.get("stock") === null
                    ? undefined
                    : Number(formData.get("stock")),
            isActive:
                isActiveValue === null
                    ? undefined
                    : isActiveValue === "true",
            categoryId: formData.get("categoryId"),
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid product data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        // 6. Update shared catalog product
        const [updatedProduct] = await db
            .update(productSchema)
            .set({
                name: result.data.name,
                slug: result.data.slug,
                sku: result.data.sku,
                description: result.data.description,
                price: result.data.price,
                stock: result.data.stock,
                categoryId: result.data.categoryId,
                ...(result.data.isActive !== undefined
                    ? { isActive: result.data.isActive }
                    : {}),
                updatedAt: new Date(),
            })
            .where(eq(productSchema.id, productId))
            .returning();

        if (!updatedProduct) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Product updated successfully",
                data: updatedProduct,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("UPDATE_PRODUCT_ERROR:", error);

        const dbError = error as { code?: string };

        if (dbError.code === "23505") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product slug or SKU already exists",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to update product",
            },
            { status: 500 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        // 1. Authenticate admin
        const auth = await verifyAdminToken(req);

        if (!auth.success) {
            return auth.response;
        }

        // 2. Only admin and super_admin can deactivate products
        const allowedRoles = ["admin", "super_admin"];

        if (!allowedRoles.includes(auth.payload.role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "You do not have permission to delete products",
                },
                { status: 403 }
            );
        }

        // 3. Get product ID
        const { productId } = await params;

        // 4. Deactivate the catalog product
        const [deletedProduct] = await db
            .update(productSchema)
            .set({
                isActive: false,
                updatedAt: new Date(),
            })
            .where(eq(productSchema.id, productId))
            .returning({
                id: productSchema.id,
                name: productSchema.name,
                isActive: productSchema.isActive,
            });

        if (!deletedProduct) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Product deactivated successfully",
                data: deletedProduct,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("DELETE_PRODUCT_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to deactivate product",
            },
            { status: 500 }
        );
    }
}





// search product

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ productId: string }> }
) {
    try {
        const { productId } = await params;

        // Validate product UUID
        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

        if (!uuidRegex.test(productId)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid product ID",
                },
                { status: 400 }
            );
        }

        // Fetch active catalog product
        const [product] = await db
            .select({
                productId: productSchema.id,
                name: productSchema.name,
                slug: productSchema.slug,
                description: productSchema.description,
                imageUrl: productSchema.imageUrl,
                categoryId: categorySchema.id,
                categoryName: categorySchema.name,
                createdAt: productSchema.createdAt,
            })
            .from(productSchema)
            .innerJoin(
                categorySchema,
                eq(productSchema.categoryId, categorySchema.id)
            )
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
                    message: "Product not found",
                },
                { status: 404 }
            );
        }

        // Fetch offers from approved and active vendors
        const offers = await db
            .select({
                listingId: vendorProductSchema.id,
                vendorId: vendors.id,
                vendorName: vendors.name,
                price: vendorProductSchema.price,
                stock: vendorProductSchema.stock,
            })
            .from(vendorProductSchema)
            .innerJoin(
                vendors,
                eq(vendorProductSchema.vendorId, vendors.id)
            )
            .where(
                and(
                    eq(vendorProductSchema.productId, productId),
                    eq(vendorProductSchema.isActive, true),
                    eq(vendors.status, "approved"),
                    eq(vendors.isActive, true)
                )
            )
            .orderBy(vendorProductSchema.price);

        // A catalog product without eligible offers is not purchasable
        if (offers.length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product is currently unavailable",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Product details fetched successfully",
                data: {
                    ...product,
                    offers,
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_CUSTOMER_PRODUCT_DETAILS_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch product details",
            },
            { status: 500 }
        );
    }
}
