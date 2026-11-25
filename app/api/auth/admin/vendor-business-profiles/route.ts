import { desc, eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/auth/admin/lib/require-admin";
import { db } from "@/app/api/lib/db";
import { vendorBusinessProfiles } from "@/app/api/lib/schema/vendor-business-profile";
import { vendors } from "@/app/api/lib/schema/vendor";

export async function GET(request: NextRequest) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    try {
        const profiles = await db
            .select({
                vendorId: vendorBusinessProfiles.vendorId,
                vendorName: vendors.name,
                vendorEmail: vendors.email,
                businessName: vendorBusinessProfiles.businessName,
                businessType: vendorBusinessProfiles.businessType,
                authorizedPersonName:
                    vendorBusinessProfiles.authorizedPersonName,
                businessEmail: vendorBusinessProfiles.businessEmail,
                businessPhone: vendorBusinessProfiles.businessPhone,
                gstRegistrationStatus:
                    vendorBusinessProfiles.gstRegistrationStatus,
                gstin: vendorBusinessProfiles.gstin,
                pan: vendorBusinessProfiles.pan,
                hasGstDocument: sql<boolean>`${vendorBusinessProfiles.gstDocumentPublicId} IS NOT NULL`,
                addressLine1: vendorBusinessProfiles.addressLine1,
                addressLine2: vendorBusinessProfiles.addressLine2,
                city: vendorBusinessProfiles.city,
                state: vendorBusinessProfiles.state,
                pinCode: vendorBusinessProfiles.pinCode,
                country: vendorBusinessProfiles.country,
                invoiceDisplayName: vendorBusinessProfiles.invoiceDisplayName,
                invoicePrefix: vendorBusinessProfiles.invoicePrefix,
                paymentInformation: vendorBusinessProfiles.paymentInformation,
                verificationStatus: vendorBusinessProfiles.verificationStatus,
                rejectionReason: vendorBusinessProfiles.rejectionReason,
                reviewMessage: vendorBusinessProfiles.reviewMessage,
                createdAt: vendorBusinessProfiles.createdAt,
                updatedAt: vendorBusinessProfiles.updatedAt,
            })
            .from(vendorBusinessProfiles)
            .innerJoin(vendors, eq(vendors.id, vendorBusinessProfiles.vendorId))
            .orderBy(desc(vendorBusinessProfiles.updatedAt));

        return NextResponse.json({ success: true, data: profiles });
    } catch (error) {
        console.error("GET_VENDOR_BUSINESS_PROFILES_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to load business profiles" },
            { status: 500 }
        );
    }
}
