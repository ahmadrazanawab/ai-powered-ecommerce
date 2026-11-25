import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/app/api/lib/db";
import { deleteVendorGstDocument } from "@/app/api/lib/vendor-business-document-storage";
import { vendorBusinessProfiles } from "@/app/api/lib/schema/vendor-business-profile";
import { vendorBusinessProfileSchema } from "@/app/api/lib/validations/vendor-business-profile";
import { verifyVendorToken } from "../verify-token-vendor";

export const runtime = "nodejs";

function publicProfile(
    profile: typeof vendorBusinessProfiles.$inferSelect
) {
    const { gstDocumentPublicId, gstDocumentFormat, ...safeProfile } = profile;
    return {
        ...safeProfile,
        hasGstDocument: Boolean(gstDocumentPublicId && gstDocumentFormat),
    };
}

function databaseErrorCode(error: unknown): string | undefined {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return undefined;
    }
    return typeof error.code === "string" ? error.code : undefined;
}

export async function GET(request: NextRequest) {
    const auth = await verifyVendorToken(request);
    if (!auth.success) return auth.response;

    try {
        const [profile] = await db
            .select()
            .from(vendorBusinessProfiles)
            .where(eq(vendorBusinessProfiles.vendorId, auth.payload.vendorId))
            .limit(1);

        return NextResponse.json({
            success: true,
            data: profile ? publicProfile(profile) : null,
        });
    } catch (error) {
        console.error("GET_VENDOR_BUSINESS_PROFILE_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to load business information" },
            { status: 500 }
        );
    }
}

export async function POST(request: NextRequest) {
    const auth = await verifyVendorToken(request);
    if (!auth.success) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const parsed = vendorBusinessProfileSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                message: "Please correct the highlighted business information",
                errors: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
        );
    }

    const profile = parsed.data;
    try {
        const [created] = await db
            .insert(vendorBusinessProfiles)
            .values({
                vendorId: auth.payload.vendorId,
                ...profile,
                gstin:
                    profile.gstRegistrationStatus === "unregistered"
                        ? null
                        : profile.gstin,
                addressLine2: profile.addressLine2 || null,
                invoicePrefix: profile.invoicePrefix || null,
                paymentInformation: profile.paymentInformation || null,
                verificationStatus: "pending",
            })
            .returning();

        return NextResponse.json(
            {
                success: true,
                message: "Business information saved",
                data: publicProfile(created),
            },
            { status: 201 }
        );
    } catch (error) {
        if (databaseErrorCode(error) === "23505") {
            return NextResponse.json(
                {
                    success: false,
                    message: "A business profile already exists for this vendor",
                },
                { status: 409 }
            );
        }
        console.error("CREATE_VENDOR_BUSINESS_PROFILE_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to save business information" },
            { status: 500 }
        );
    }
}

export async function PATCH(request: NextRequest) {
    const auth = await verifyVendorToken(request);
    if (!auth.success) return auth.response;

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { success: false, message: "Invalid JSON body" },
            { status: 400 }
        );
    }

    const parsed = vendorBusinessProfileSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            {
                success: false,
                message: "Please correct the highlighted business information",
                errors: parsed.error.flatten().fieldErrors,
            },
            { status: 400 }
        );
    }

    const profile = parsed.data;
    try {
        const [existing] = await db
            .select({
                gstDocumentPublicId: vendorBusinessProfiles.gstDocumentPublicId,
            })
            .from(vendorBusinessProfiles)
            .where(eq(vendorBusinessProfiles.vendorId, auth.payload.vendorId))
            .limit(1);

        const [updated] = await db
            .update(vendorBusinessProfiles)
            .set({
                ...profile,
                gstin:
                    profile.gstRegistrationStatus === "unregistered"
                        ? null
                        : profile.gstin,
                gstDocumentPublicId:
                    profile.gstRegistrationStatus === "unregistered"
                        ? null
                        : undefined,
                gstDocumentFormat:
                    profile.gstRegistrationStatus === "unregistered"
                        ? null
                        : undefined,
                addressLine2: profile.addressLine2 || null,
                invoicePrefix: profile.invoicePrefix || null,
                paymentInformation: profile.paymentInformation || null,
                verificationStatus: "pending",
                rejectionReason: null,
                reviewMessage: null,
                reviewedBy: null,
                reviewedAt: null,
                updatedAt: new Date(),
            })
            .where(eq(vendorBusinessProfiles.vendorId, auth.payload.vendorId))
            .returning();

        if (!updated) {
            return NextResponse.json(
                { success: false, message: "Create a business profile first" },
                { status: 404 }
            );
        }

        if (
            profile.gstRegistrationStatus === "unregistered" &&
            existing?.gstDocumentPublicId
        ) {
            try {
                await deleteVendorGstDocument(existing.gstDocumentPublicId);
            } catch (error) {
                console.error("DELETE_UNREGISTERED_GST_DOCUMENT_ERROR:", error);
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Business information was saved, but the old GST document could not be removed",
                    },
                    { status: 502 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: "Business information updated and sent for review",
            data: publicProfile(updated),
        });
    } catch (error) {
        console.error("UPDATE_VENDOR_BUSINESS_PROFILE_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Failed to update business information" },
            { status: 500 }
        );
    }
}
