import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/app/api/lib/db";
import {
    deleteVendorGstDocument,
    getVendorDocumentFile,
    uploadVendorGstDocument,
    VendorDocumentValidationError,
} from "@/app/api/lib/vendor-business-document-storage";
import { vendorBusinessProfiles } from "@/app/api/lib/schema/vendor-business-profile";
import { verifyVendorToken } from "../../verify-token-vendor";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    const auth = await verifyVendorToken(request);
    if (!auth.success) return auth.response;

    let uploaded: Awaited<ReturnType<typeof uploadVendorGstDocument>> | null =
        null;

    try {
        const [profile] = await db
            .select({
                gstRegistrationStatus:
                    vendorBusinessProfiles.gstRegistrationStatus,
                gstDocumentPublicId: vendorBusinessProfiles.gstDocumentPublicId,
            })
            .from(vendorBusinessProfiles)
            .where(eq(vendorBusinessProfiles.vendorId, auth.payload.vendorId))
            .limit(1);

        if (!profile) {
            return NextResponse.json(
                { success: false, message: "Save business information first" },
                { status: 409 }
            );
        }
        if (profile.gstRegistrationStatus === "unregistered") {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "GST documents are available only for registered businesses",
                },
                { status: 400 }
            );
        }

        const file = getVendorDocumentFile(await request.formData());
        uploaded = await uploadVendorGstDocument(file, auth.payload.vendorId);

        const [updated] = await db
            .update(vendorBusinessProfiles)
            .set({
                gstDocumentPublicId: uploaded.publicId,
                gstDocumentFormat: uploaded.format,
                verificationStatus: "pending",
                rejectionReason: null,
                reviewMessage: null,
                reviewedBy: null,
                reviewedAt: null,
                updatedAt: new Date(),
            })
            .where(eq(vendorBusinessProfiles.vendorId, auth.payload.vendorId))
            .returning({ vendorId: vendorBusinessProfiles.vendorId });

        if (!updated) {
            await deleteVendorGstDocument(uploaded.publicId);
            return NextResponse.json(
                { success: false, message: "Business profile not found" },
                { status: 404 }
            );
        }

        if (
            profile.gstDocumentPublicId &&
            profile.gstDocumentPublicId !== uploaded.publicId
        ) {
            try {
                await deleteVendorGstDocument(profile.gstDocumentPublicId);
            } catch (error) {
                console.error("REPLACE_VENDOR_GST_DOCUMENT_CLEANUP_ERROR:", error);
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Document was uploaded, but the previous document could not be removed",
                    },
                    { status: 502 }
                );
            }
        }

        return NextResponse.json({
            success: true,
            message: "GST document uploaded and sent for review",
            data: { hasGstDocument: true },
        });
    } catch (error) {
        if (uploaded) {
            try {
                await deleteVendorGstDocument(uploaded.publicId);
            } catch (cleanupError) {
                console.error("CLEANUP_FAILED_VENDOR_GST_DOCUMENT:", cleanupError);
            }
        }
        if (error instanceof VendorDocumentValidationError) {
            return NextResponse.json(
                { success: false, message: error.message },
                { status: 400 }
            );
        }
        console.error("UPLOAD_VENDOR_GST_DOCUMENT_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Could not upload the GST document" },
            { status: 502 }
        );
    }
}

export async function DELETE(request: NextRequest) {
    const auth = await verifyVendorToken(request);
    if (!auth.success) return auth.response;

    try {
        const [profile] = await db
            .select({
                gstDocumentPublicId: vendorBusinessProfiles.gstDocumentPublicId,
            })
            .from(vendorBusinessProfiles)
            .where(eq(vendorBusinessProfiles.vendorId, auth.payload.vendorId))
            .limit(1);

        if (!profile) {
            return NextResponse.json(
                { success: false, message: "Business profile not found" },
                { status: 404 }
            );
        }

        if (profile.gstDocumentPublicId) {
            await deleteVendorGstDocument(profile.gstDocumentPublicId);
        }

        await db
            .update(vendorBusinessProfiles)
            .set({
                gstDocumentPublicId: null,
                gstDocumentFormat: null,
                verificationStatus: "pending",
                rejectionReason: null,
                reviewMessage: null,
                reviewedBy: null,
                reviewedAt: null,
                updatedAt: new Date(),
            })
            .where(eq(vendorBusinessProfiles.vendorId, auth.payload.vendorId));

        return NextResponse.json({
            success: true,
            message: "GST document removed",
        });
    } catch (error) {
        console.error("DELETE_VENDOR_GST_DOCUMENT_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Could not remove the GST document" },
            { status: 502 }
        );
    }
}
