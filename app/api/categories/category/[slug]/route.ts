// FILE: app/api/categories/[slug]/route.ts
// GET: one category by slug

import { NextRequest, NextResponse } from "next/server";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { db } from "@/app/api/lib/db";
import { eq } from "drizzle-orm";
export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ slug: string }> } // Next.js 15: params is a Promise
) {
    try {
        const { slug } = await params;

        const [category] = await db
            .select({
                categoryId: categorySchema.id,
                name: categorySchema.name,
                slug: categorySchema.slug,
                description: categorySchema.description,
                imageUrl: categorySchema.imageUrl,
            })
            .from(categorySchema)
            .where(eq(categorySchema.slug, slug))
            .limit(1);

        if (!category) {
            return NextResponse.json(
                { success: false, message: "Category not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Category fetched successfully",
                data: category,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_CATEGORY_BY_SLUG_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch category" },
            { status: 500 }
        );
    }
}