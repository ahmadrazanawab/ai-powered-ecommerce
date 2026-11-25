import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/auth/admin/lib/require-admin";
import { db } from "@/app/api/lib/db";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendorBusinessProfiles } from "@/app/api/lib/schema/vendor-business-profile";
import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { vendorProductTaxProfiles } from "@/app/api/lib/schema/vendor-product-tax-profile";

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const listings = await db
            .select({
                listingId: vendorProductSchema.id,
                vendorId: vendors.id,
                vendorName: vendors.name,
                productName: productSchema.name,
                sku: productSchema.sku,
                price: vendorProductSchema.price,
                gstStatus: vendorBusinessProfiles.gstRegistrationStatus,
                verificationStatus: vendorBusinessProfiles.verificationStatus,
                hsnCode: vendorProductTaxProfiles.hsnCode,
                gstRate: vendorProductTaxProfiles.gstRate,
                taxUpdatedAt: vendorProductTaxProfiles.updatedAt,
            })
            .from(vendorProductSchema)
            .innerJoin(vendors, eq(vendors.id, vendorProductSchema.vendorId))
            .innerJoin(productSchema, eq(productSchema.id, vendorProductSchema.productId))
            .leftJoin(
                vendorBusinessProfiles,
                eq(vendorBusinessProfiles.vendorId, vendors.id)
            )
            .leftJoin(
                vendorProductTaxProfiles,
                eq(
                    vendorProductTaxProfiles.vendorProductId,
                    vendorProductSchema.id
                )
            )
            .orderBy(asc(vendors.name), asc(productSchema.name));

        return NextResponse.json({ success: true, data: listings });
    } catch (error) {
        console.error("GET_VENDOR_PRODUCT_TAXES_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to load tax settings" },
            { status: 500 }
        );
    }
}
