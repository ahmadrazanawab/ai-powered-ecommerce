import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db"; 
import { productSchema } from "@/app/api/lib/schema/product-schema"; 
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema"; 
import { vendors } from "@/app/api/lib/schema/vendor";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { verifyVendorToken } from "../verify-token-vendor"; 

export const runtime = "nodejs";

// POST: Vendor lists an existing catalog product
export async function POST(req: NextRequest) {
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

    const body = await req.json();

    const productId =
      typeof body.productId === "string" ? body.productId : "";
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
    const [listing] = await db
      .insert(vendorProductSchema)
      .values({
        vendorId,
        productId,
        price: String(price),
        stock: Number(stock),
        isActive: body.isActive === undefined ? true : body.isActive === true,
      })
      .returning();

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
        description: productSchema.description,
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

    return NextResponse.json(
      {
        success: true,
        message: "Products fetched successfully",
        data: products,
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
