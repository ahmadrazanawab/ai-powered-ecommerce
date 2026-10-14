
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/app/api/lib/db";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { categoryValidation } from "@/app/api/lib/validations/category-validation";
import { verifyAdminToken } from "@/app/api/auth/admin/verify-token";

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

        // 3. Parse JSON body
        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid JSON body",
                },
                { status: 400 }
            );
        }

        // 4. Validate with Zod
        const result = categoryValidation.safeParse(body);

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

        const { name, slug, description, imageUrl } = result.data;

        // 5. Check for existing name or slug
        const [existingCategory] = await db
            .select({
                id: categorySchema.id,
                name: categorySchema.name,
                slug: categorySchema.slug,
            })
            .from(categorySchema)
            .where(
                or(
                    eq(categorySchema.name, name),
                    eq(categorySchema.slug, slug)
                )
            )
            .limit(1);

        if (existingCategory) {
            if (existingCategory.name === name) {
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

        // 6. Insert category
        const [category] = await db
            .insert(categorySchema)
            .values({
                name,
                slug,
                description: description || null,
                imageUrl: imageUrl || null,
                createdBy: auth.payload.adminId,
            })
            .returning();

        // 7. Return response
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
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}



// get all Categories
export async function GET(_req: NextRequest) {
    try {
        const getCategories = await db
            .select({
                categoryId: categorySchema.id,
                name: categorySchema.name,
                slug: categorySchema.slug,
                imageUrl: categorySchema.imageUrl
            })
            .from(categorySchema);
        
        return NextResponse.json({
            success: true,
            message: "Fetch all categories successful!",
            data:getCategories
        })
    } catch (error) {
        console.log("GET_CATEGORIES_ERROR", error);
        return NextResponse.json({
            success: false,
            error: "Internal server error..."
        }, { status: 500 });
    }
}
