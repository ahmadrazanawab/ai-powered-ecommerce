import { NextRequest, NextResponse } from "next/server";

import { db } from "@/app/api/lib/db";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { categoryValidation } from "@/app/api/lib/validations/category-validation";
import { verifyAdminToken } from "@/app/api/auth/admin/verify-token";
import { uploadImageToCloudinary } from "@/app/api/lib/cloudinary";

import { eq, or } from "drizzle-orm";

export async function POST(request: NextRequest) {
    try {
        // 1. Verify admin JWT
        const auth = await verifyAdminToken(request);

        if (!auth.success) {
            return auth.response;
        }

        // 2. Check permissions
        const allowedRoles = ["admin", "super_admin"];

        if (!allowedRoles.includes(auth.payload.role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "You do not have permission to create categories",
                },
                { status: 403 }
            );
        }

        // 3. Parse FormData
        const formData = await request.formData();

        const name = formData.get("name");
        const slug = formData.get("slug");
        const description = formData.get("description");
        const image = formData.get("image");

        // 4. Upload category image to Cloudinary
        let imageUrl: string | null = null;

        if (image instanceof File && image.size > 0) {
            const uploadedImage = await uploadImageToCloudinary(
                image,
                "aiecommerce/categories"
            );

            imageUrl = uploadedImage.url;
        }

        // 5. Validate with Zod
        const result = categoryValidation.safeParse({
            name,
            slug,
            description: description || undefined,
            imageUrl: imageUrl || undefined,
        });

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid category data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const {
            name: categoryName,
            slug: categorySlug,
            description: categoryDescription,
        } = result.data;

        // 6. Check for existing name or slug
        const [existingCategory] = await db
            .select({
                id: categorySchema.id,
                name: categorySchema.name,
                slug: categorySchema.slug,
            })
            .from(categorySchema)
            .where(
                or(
                    eq(categorySchema.name, categoryName),
                    eq(categorySchema.slug, categorySlug)
                )
            )
            .limit(1);

        if (existingCategory) {
            if (existingCategory.name === categoryName) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Category name already exists",
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    message: "Category slug already exists",
                },
                { status: 409 }
            );
        }

        // 7. Insert category
        const [category] = await db
            .insert(categorySchema)
            .values({
                name: categoryName,
                slug: categorySlug,
                description: categoryDescription || null,
                imageUrl,
                createdBy: auth.payload.adminId,
            })
            .returning();

        // 8. Return response
        return NextResponse.json(
            {
                success: true,
                message: "Category created successfully",
                category,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE_CATEGORY_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message:
                    error instanceof Error
                        ? error.message
                        : "Internal server error",
            },
            { status: 500 }
        );
    }
}


// GET all categories
export async function GET(_req: NextRequest) {
    try {
        const getCategories = await db
            .select({
                categoryId: categorySchema.id,
                name: categorySchema.name,
                slug: categorySchema.slug,
                description: categorySchema.description,
                imageUrl: categorySchema.imageUrl,
            })
            .from(categorySchema)
            .orderBy(categorySchema.name);

        return NextResponse.json(
            {
                success: true,
                message: "Categories fetched successfully!",
                data: getCategories,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_CATEGORIES_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}