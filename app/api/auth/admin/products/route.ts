import { NextRequest, NextResponse } from "next/server";
import { count, desc, eq, ilike, or } from "drizzle-orm";
import { db } from "@/app/api/lib/db"; 
import { productSchema } from "@/app/api/lib/schema/product-schema"; 
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { verifyAdminToken } from "../verify-token"; 

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAdminToken(req);
        if (!auth.success) return auth.response;

        if (!["admin", "super_admin"].includes(auth.payload.role)) {
            return NextResponse.json(
                { success: false, message: "You do not have permission to view products" },
                { status: 403 }
            );
        }

        const { searchParams } = new URL(req.url);
        const search = searchParams.get("search")?.trim();
        const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
        const limit = Math.min(100, Math.max(1, Number.parseInt(searchParams.get("limit") || "12", 10) || 12));

        const pattern = `%${search}%`;
        const where = search
            ? or(
                ilike(productSchema.name, pattern),
                ilike(productSchema.slug, pattern),
                ilike(productSchema.sku, pattern),
                ilike(categorySchema.name, pattern)
            )
            : undefined;

        const [totalResult] = await db
            .select({ total: count() })
            .from(productSchema)
            .innerJoin(categorySchema, eq(productSchema.categoryId, categorySchema.id))
            .where(where);

        const data = await db
            .select({
                productId: productSchema.id,
                name: productSchema.name,
                slug: productSchema.slug,
                sku: productSchema.sku,
                description: productSchema.description,
                price: productSchema.price,
                stock: productSchema.stock,
                imageUrl: productSchema.imageUrl,
                isActive: productSchema.isActive,
                categoryId: productSchema.categoryId,
                categoryName: categorySchema.name,
            })
            .from(productSchema)
            .innerJoin(categorySchema, eq(productSchema.categoryId, categorySchema.id))
            .where(where)
            .orderBy(desc(productSchema.createdAt))
            .limit(limit)
            .offset((page - 1) * limit);

        const total = Number(totalResult?.total ?? 0);

        return NextResponse.json({
            success: true,
            message: "Products fetched successfully",
            data,
            pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
        });
    } catch (error) {
        console.error("ADMIN_LIST_PRODUCTS_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to fetch products" },
            { status: 500 }
        );
    }
}