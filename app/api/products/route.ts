
import { NextRequest, NextResponse } from "next/server";
import {
    eq, and,
    asc,
    count,
    desc,
    ilike,
    or,
} from "drizzle-orm";

import { db } from "../lib/db";
import { productSchema } from "../lib/schema/product-schema";
import { productValidation } from "../lib/validations/product-validation";
import { verifyAdminToken } from "../auth/admin/verify-token";
import { uploadImageToCloudinary } from "../lib/cloudinary";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";


export const runtime = "nodejs";

// POST: Admin creates a shared catalog product
export async function POST(req: NextRequest) {
    let uploadedPublicId: string | undefined;

    try {
        // 1. Authenticate admin
        const auth = await verifyAdminToken(req);

        if (!auth.success) {
            return auth.response;
        }

        // 2. Check admin role
        const allowedRoles = ["admin", "super_admin"];

        if (!allowedRoles.includes(auth.payload.role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "You do not have permission to create products",
                },
                { status: 403 }
            );
        }

        // 3. Read multipart form data
        const formData = await req.formData();
        const image = formData.get("image");

        if (!(image instanceof File) || image.size === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Product image is required",
                },
                { status: 400 }
            );
        }

        // Support either isActive or is_active
        const isActiveValue =
            formData.get("isActive") ?? formData.get("is_active");

        const stockValue = formData.get("stock");

        // 4. Validate product fields
        const result = productValidation.safeParse({
            name: formData.get("name"),
            slug: formData.get("slug"),
            sku: formData.get("sku"),
            description: formData.get("description"),
            price: formData.get("price"),
            stock: stockValue === null ? undefined : Number(stockValue),
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

        // 5. Upload product image
        const uploadedImage = await uploadImageToCloudinary(image);
        uploadedPublicId = uploadedImage.publicId;

        // 6. Insert into the shared catalog
        const [product] = await db
            .insert(productSchema)
            .values({
                ...result.data,
                imageUrl: uploadedImage.url,
                createdBy: auth.payload.adminId,
            })
            .returning();

        return NextResponse.json(
            {
                success: true,
                message: "Product created successfully",
                product,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE_PRODUCT_ERROR:", error);

        // Handle duplicate slug/SKU errors from PostgreSQL
        const dbError = error as {
            code?: string;
            constraint?: string;
        };

        if (
            dbError.code === "23505" &&
            (dbError.constraint?.includes("slug") ||
                dbError.constraint?.includes("sku"))
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A product with this slug or SKU already exists",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create product",
            },
            { status: 500 }
        );
    }
}







export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);

        // Search and filters
        const search = searchParams.get("search")?.trim();
        const categoryId = searchParams.get("categoryId");

        // Pagination
        const page = Math.max(
            1,
            Number.parseInt(searchParams.get("page") || "1", 10) || 1
        );

        const limit = Math.min(
            100,
            Math.max(
                1,
                Number.parseInt(searchParams.get("limit") || "12", 10) || 12
            )
        );

        const offset = (page - 1) * limit;

        // Sorting
        const sortBy = searchParams.get("sortBy") || "newest";
        const sortOrder = searchParams.get("sortOrder") || "desc";

        if (
            !["name", "price", "newest"].includes(sortBy) ||
            !["asc", "desc"].includes(sortOrder)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid sorting parameters",
                },
                { status: 400 }
            );
        }

        // Customer visibility rules
        const conditions = [
            eq(productSchema.isActive, true),
            eq(vendorProductSchema.isActive, true),
            eq(vendors.status, "approved"),
            eq(vendors.isActive, true),
        ];

        if (categoryId) {
            conditions.push(eq(productSchema.categoryId, categoryId));
        }

        if (search) {
            const searchPattern = `%${search}%`;

            conditions.push(
                or(
                    ilike(productSchema.name, searchPattern),
                    ilike(productSchema.slug, searchPattern),
                    ilike(productSchema.description, searchPattern),
                    ilike(categorySchema.name, searchPattern)
                )!
            );
        }

        const whereCondition = and(...conditions);

        // Total number of eligible offers matching the filters
        const [totalResult] = await db
            .select({ total: count() })
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
            .where(whereCondition);

        // Sorting uses the vendor's offer price, not the catalog price
        const orderBy =
            sortBy === "name"
                ? sortOrder === "asc"
                    ? asc(productSchema.name)
                    : desc(productSchema.name)
                : sortBy === "price"
                    ? sortOrder === "asc"
                        ? asc(vendorProductSchema.price)
                        : desc(vendorProductSchema.price)
                    : sortOrder === "asc"
                        ? asc(productSchema.createdAt)
                        : desc(productSchema.createdAt);

        // Fetch offers available to customers
        const products = await db
            .select({
                listingId: vendorProductSchema.id,
                productId: productSchema.id,
                name: productSchema.name,
                slug: productSchema.slug,
                description: productSchema.description,
                imageUrl: productSchema.imageUrl,
                categoryId: categorySchema.id,
                categoryName: categorySchema.name,

                // Vendor-specific values
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
            .where(whereCondition)
            .orderBy(orderBy)
            .limit(limit)
            .offset(offset);

        const total = Number(totalResult?.total ?? 0);

        return NextResponse.json(
            {
                success: true,
                message: "Products fetched successfully",
                data: products,
                pagination: {
                    page,
                    limit,
                    total,
                    totalPages: Math.ceil(total / limit),
                },
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_CUSTOMER_PRODUCTS_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to fetch products",
            },
            { status: 500 }
        );
    }
}
