
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "../lib/db";
import { productSchema } from "../lib/schema/product-schema";
import { vendorProductSchema } from "../lib/schema/vendor-product-schema";
import { vendors } from "../lib/schema/vendor";
import { categorySchema } from "../lib/schema/category-schema";
import { productValidation } from "../lib/validations/product-validation";
import { verifyAdminToken } from "../auth/admin/verify-token";
import { uploadImageToCloudinary } from "../lib/cloudinary";

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



// get all products
export async function GET() {
  try {
    const products = await db
      .select({
        id: productSchema.id,
        name: productSchema.name,
        slug: productSchema.slug,
        sku: productSchema.sku,
        description: productSchema.description,
        categoryId: productSchema.categoryId,
        imageUrl: productSchema.imageUrl,
      })
      .from(productSchema)
      .where(eq(productSchema.isActive, true));

    return NextResponse.json({
      success: true,
      data: products,
    });
  } catch (error) {
    console.error("GET_CATALOG_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch catalog" },
      { status: 500 }
    );
  }
}



// export async function GET() {
//     try {
//         const getProducts = await db
//             .select({
//                 id: productSchema.id,
//                 categoryId: productSchema.categoryId,
//                 name: productSchema.name,
//                 slug: productSchema.slug,
//                 sku: productSchema.sku,
//                 description: productSchema.description,
//                 price: productSchema.price,
//                 stock: productSchema.stock,
//                 imageUrl: productSchema.imageUrl,
//                 isActive: productSchema.isActive,
//                 createdBy: productSchema.createdBy,
//                 createdAt: productSchema.createdAt,
//                 updatedAt: productSchema.updatedAt,
//             })
//             .from(productSchema)
//             .where(eq(productSchema.isActive, true));

//         return NextResponse.json(
//             {
//                 success: true,
//                 message: "Products fetched successfully",
//                 data: getProducts,
//             },
//             { status: 200 }
//         );
//     } catch (error) {
//         console.error("GET_PRODUCTS_ERROR:", error);

//         return NextResponse.json(
//             {
//                 success: false,
//                 message: "Failed to fetch products",
//             },
//             { status: 500 }
//         );
//     }
// }
