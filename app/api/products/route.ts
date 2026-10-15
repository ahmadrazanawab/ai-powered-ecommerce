
import { NextRequest, NextResponse } from "next/server";
import { db } from "../lib/db";
import { productSchema } from "../lib/schema/product-schema";
import { productValidation } from "../lib/validations/product-validation";
import { verifyAdminToken } from "../auth/admin/verify-token";
import { verifyVendorToken } from "../auth/vendor/verify-token-vendor";
import { uploadImageToCloudinary } from "../lib/cloudinary";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
    let uploadedPublicId: string | undefined;

    try {
        // 1. Check both authentication methods.
        // A failed admin check must not block a valid vendor, and vice versa.
        const [adminAuth, vendorAuth] = await Promise.all([
            verifyAdminToken(req),
            verifyVendorToken(req),
        ]);

        const allowedRoles = ["admin", "super_admin"];

        const isAdmin =
            adminAuth.success &&
            allowedRoles.includes(adminAuth.payload.role);

        const isVendor = vendorAuth.success;

        if (!isAdmin && !isVendor) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Authentication required or insufficient permissions",
                },
                { status: 403 }
            );
        }

        // 2. Read multipart form data.
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

        //   typeof stockValue === "string" && stockValue.trim() !== ""
        //   ? Number(stockValue)
        //   : undefined,

        // 3. Validate product fields.
        const result = productValidation.safeParse({
            name: formData.get("name"),
            slug: formData.get("slug"),
            sku: formData.get("sku"),
            description: formData.get("description"),
            price: formData.get("price"),
            stock: Number(formData.get("stock")),
            isActive: formData.get("is_active") === null ? undefined : formData.get("isActive") === "true",
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

        // 4. Upload image to Cloudinary.
        const uploadedImage = await uploadImageToCloudinary(image);
        uploadedPublicId = uploadedImage.publicId;

        // 5. Determine ownership and publishing status.
        // Vendors should not be allowed to publish products immediately.
        const productValues = {
            ...result.data,
            imageUrl: uploadedImage.url,
            vendorId: isVendor ? vendorAuth.payload.vendorId : null,
            isActive: isAdmin ? result.data.isActive : false,
        };

        // 6. Insert actual validated values, not Drizzle column objects.
        const [addProduct] = await db
            .insert(productSchema)
            .values(productValues)
            .returning();

        return NextResponse.json(
            {
                success: true,
                message: "Product created successfully",
                product: addProduct,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("CREATE_PRODUCT_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Failed to create product",
            },
            { status: 500 }
        );
    }
}
