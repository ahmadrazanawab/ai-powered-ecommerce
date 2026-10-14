
import { NextResponse, NextRequest } from "next/server";
import { categorySchema } from "../../lib/schema/category-schema";
import { db } from "../../lib/db";
import { categoryValidation } from "../../lib/validations/category-validation";
import { eq } from "drizzle-orm";
import { verifyAdminToken } from "../../auth/admin/verify-token";

export async function PUT(
    req: NextRequest,
    { params }: { params: Promise<{ categoryId: string }> }
) {
    try {

        const auth = await verifyAdminToken(req);
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

        const { categoryId } = await params;
        const body = await req.json();

        const result = categoryValidation.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid update data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { name, slug, description, imageUrl } = result.data;

        const [updatedCategory] = await db
            .update(categorySchema)
            .set({
                name,
                slug,
                description,
                imageUrl,
            })
            .where(eq(categorySchema.id, categoryId))
            .returning();

        if (!updatedCategory) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Category not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Update category successful",
                data: updatedCategory,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("UPDATE_CATEGORY_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}

// delete category
export async function DELETE(req: NextRequest,
    { params }: { params: Promise<{ categoryId: string }> }) {
    try {

        const auth = await verifyAdminToken(req);
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
        const { categoryId } = await params;
        const [deletedCategory] = await db
            .delete(categorySchema)
            .where(eq(categorySchema.id, categoryId))
            .returning();

        if (!deletedCategory) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Category not found",
                },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Delete category successful",
                data: deletedCategory,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("DELETE_CATEGORY_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
