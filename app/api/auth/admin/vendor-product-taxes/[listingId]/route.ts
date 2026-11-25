import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/app/api/auth/admin/lib/require-admin";
import { db } from "@/app/api/lib/db";
import { vendorProductTaxProfiles } from "@/app/api/lib/schema/vendor-product-tax-profile";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { gstRateToBasisPoints } from "@/app/api/lib/invoices/money";

type RouteContext = { params: Promise<{ listingId: string }> };
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const taxInputSchema = z.object({
    hsnCode: z.string().trim().regex(/^\d{4}(?:\d{2}){0,2}$/),
    gstRate: z.string().trim().regex(/^\d{1,3}(?:\.\d{1,2})?$/),
});

export async function PUT(request: NextRequest, context: RouteContext) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { listingId } = await context.params;
    if (!uuidPattern.test(listingId)) {
        return NextResponse.json(
            { success: false, message: "Invalid listing ID" },
            { status: 400 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const parsed = taxInputSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                message: "Enter an HSN code (4, 6, or 8 digits) and GST rate",
            },
            { status: 400 }
        );
    }

    try {
        gstRateToBasisPoints(parsed.data.gstRate);
    } catch {
        return NextResponse.json(
            { success: false, message: "GST rate must be between 0 and 100%" },
            { status: 400 }
        );
    }

    try {
        const [listing] = await db
            .select({ id: vendorProductSchema.id })
            .from(vendorProductSchema)
            .where(eq(vendorProductSchema.id, listingId))
            .limit(1);

        if (!listing) {
            return NextResponse.json(
                { success: false, message: "Vendor listing not found" },
                { status: 404 }
            );
        }

        const [saved] = await db
            .insert(vendorProductTaxProfiles)
            .values({
                vendorProductId: listingId,
                hsnCode: parsed.data.hsnCode,
                gstRate: parsed.data.gstRate,
                updatedBy: auth.admin.id,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: vendorProductTaxProfiles.vendorProductId,
                set: {
                    hsnCode: parsed.data.hsnCode,
                    gstRate: parsed.data.gstRate,
                    updatedBy: auth.admin.id,
                    updatedAt: new Date(),
                },
            })
            .returning();

        return NextResponse.json({
            success: true,
            message: "Tax settings saved for future orders",
            data: saved,
        });
    } catch (error) {
        console.error("SAVE_VENDOR_PRODUCT_TAX_PROFILE_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to save tax settings" },
            { status: 500 }
        );
    }
}
