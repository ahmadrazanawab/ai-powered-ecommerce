import { eq, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireAdmin } from "@/app/api/auth/admin/lib/require-admin";
import { db } from "@/app/api/lib/db";
import { vendorBusinessProfiles } from "@/app/api/lib/schema/vendor-business-profile";
import { vendors } from "@/app/api/lib/schema/vendor";
import { retryBlockedVendorInvoices } from "@/app/api/lib/invoices/generation";

type RouteContext = { params: Promise<{ vendorId: string }> };
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const reviewSchema = z.object({
    status: z.enum(["under_review", "verified", "rejected", "pending"]),
    message: z.string().trim().max(1000).optional().default(""),
});

export async function GET(request: NextRequest, context: RouteContext) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { vendorId } = await context.params;
    if (!uuidPattern.test(vendorId)) {
        return NextResponse.json(
            { success: false, message: "Invalid vendor ID" },
            { status: 400 }
        );
    }

    try {
        const [profile] = await db
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
            .where(eq(vendorBusinessProfiles.vendorId, vendorId))
            .limit(1);

        if (!profile) {
            return NextResponse.json(
                { success: false, message: "Business profile not found" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, data: profile });
    } catch (error) {
        console.error("GET_VENDOR_BUSINESS_PROFILE_ADMIN_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to load business profile" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const { vendorId } = await context.params;
    if (!uuidPattern.test(vendorId)) {
        return NextResponse.json(
            { success: false, message: "Invalid vendor ID" },
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

    const parsed = reviewSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, message: "Invalid review request" },
            { status: 400 }
        );
    }
    if (
        (parsed.data.status === "rejected" ||
            parsed.data.status === "pending") &&
        !parsed.data.message
    ) {
        return NextResponse.json(
            {
                success: false,
                message:
                    parsed.data.status === "rejected"
                        ? "A rejection reason is required"
                        : "A correction request message is required",
            },
            { status: 400 }
        );
    }

    try {
        const [updated] = await db
            .update(vendorBusinessProfiles)
            .set({
                verificationStatus: parsed.data.status,
                rejectionReason:
                    parsed.data.status === "rejected"
                        ? parsed.data.message
                        : null,
                reviewMessage:
                    parsed.data.status === "pending" ||
                    parsed.data.status === "under_review"
                        ? parsed.data.message || null
                        : null,
                reviewedBy: auth.admin.id,
                reviewedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(vendorBusinessProfiles.vendorId, vendorId))
            .returning({
                vendorId: vendorBusinessProfiles.vendorId,
                verificationStatus: vendorBusinessProfiles.verificationStatus,
                rejectionReason: vendorBusinessProfiles.rejectionReason,
                reviewMessage: vendorBusinessProfiles.reviewMessage,
            });

        if (!updated) {
            return NextResponse.json(
                { success: false, message: "Business profile not found" },
                { status: 404 }
            );
        }

        if (updated.verificationStatus === "verified") {
            try {
                await retryBlockedVendorInvoices(vendorId);
            } catch (error) {
                console.error("REQUEUE_VENDOR_INVOICES_ERROR:", error);
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Review saved, but blocked invoice jobs could not be requeued",
                    },
                    { status: 502 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: "Business profile review updated",
            data: updated,
        });
    } catch (error) {
        console.error("UPDATE_VENDOR_BUSINESS_PROFILE_REVIEW_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Could not update the review" },
            { status: 500 }
        );
    }
}
