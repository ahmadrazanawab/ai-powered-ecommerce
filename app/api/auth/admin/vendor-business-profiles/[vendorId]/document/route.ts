import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/app/api/auth/admin/lib/require-admin";
import { db } from "@/app/api/lib/db";
import { createVendorGstDocumentReviewUrl } from "@/app/api/lib/vendor-business-document-storage";
import { vendorBusinessProfiles } from "@/app/api/lib/schema/vendor-business-profile";

type RouteContext = { params: Promise<{ vendorId: string }> };
const uuidPattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
        const [document] = await db
            .select({
                publicId: vendorBusinessProfiles.gstDocumentPublicId,
                format: vendorBusinessProfiles.gstDocumentFormat,
            })
            .from(vendorBusinessProfiles)
            .where(eq(vendorBusinessProfiles.vendorId, vendorId))
            .limit(1);

        if (!document?.publicId || !document.format) {
            return NextResponse.json(
                { success: false, message: "GST document not found" },
                { status: 404 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                data: {
                    url: createVendorGstDocumentReviewUrl(
                        document.publicId,
                        document.format
                    ),
                    expiresInSeconds: 300,
                },
            },
            {
                headers: {
                    "Cache-Control": "private, no-store, max-age=0",
                },
            }
        );
    } catch (error) {
        console.error("GET_VENDOR_GST_DOCUMENT_REVIEW_URL_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Could not access GST document" },
            { status: 502 }
        );
    }
}
