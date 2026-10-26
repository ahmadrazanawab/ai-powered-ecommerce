import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";
import { vendors } from "@/app/api/lib/schema/vendor";

type AdminJwtPayload = {
    adminId: string;
    role: string;
    email: string;
};

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ vendorId: string }> }
) {
    try {
        // 1. Get vendor ID
        const { vendorId } = await params;

        if (
            !vendorId ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "A valid vendor ID is required",
                },
                { status: 400 }
            );
        }

        // 2. Read admin JWT cookie
        const token = request.cookies.get("admin_token")?.value;

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Authentication required",
                },
                { status: 401 }
            );
        }

        // 3. Verify JWT
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            console.error("JWT_SECRET is not configured");

            return NextResponse.json(
                {
                    success: false,
                    message: "Server configuration error",
                },
                { status: 500 }
            );
        }

        let payload: AdminJwtPayload;

        try {
            const { payload: verifiedPayload } = await jwtVerify(
                token,
                new TextEncoder().encode(secret)
            );

            payload = verifiedPayload as unknown as AdminJwtPayload;
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid or expired authentication token",
                },
                { status: 401 }
            );
        }

        if (!payload.adminId || !payload.role) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid admin token payload",
                },
                { status: 401 }
            );
        }

        // 4. Confirm the admin exists and is active
        const [currentAdmin] = await db
            .select({
                id: adminAccounts.id,
                role: adminAccounts.role,
                isActive: adminAccounts.isActive,
            })
            .from(adminAccounts)
            .where(eq(adminAccounts.id, payload.adminId))
            .limit(1);

        if (
            !currentAdmin ||
            !currentAdmin.isActive ||
            currentAdmin.role !== payload.role
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Admin account is not authorized",
                },
                { status: 403 }
            );
        }

        // 5. Both admin and super_admin can approve or reject vendors
        if (
            currentAdmin.role !== "admin" &&
            currentAdmin.role !== "super_admin"
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Only admin or super_admin can approve vendors",
                },
                { status: 403 }
            );
        }

        // 5.1 Read the optional body.
        // No body (or no action) keeps the original behavior: approve.
        let body: { action?: unknown; reason?: unknown } = {};

        try {
            const parsed = await request.json();

            if (parsed && typeof parsed === "object") {
                body = parsed;
            }
        } catch {
            // Empty body is allowed
        }

        const action = body.action ?? "approve";

        if (action !== "approve" && action !== "reject") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Action must be approve or reject",
                },
                { status: 400 }
            );
        }

        const reason =
            typeof body.reason === "string" ? body.reason.trim() : "";

        if (action === "reject") {
            if (!reason) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "A reason is required to reject a vendor",
                    },
                    { status: 400 }
                );
            }

            if (reason.length > 500) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Reason must be 500 characters or fewer",
                    },
                    { status: 400 }
                );
            }
        }

        // 6. Find the vendor
        const [targetVendor] = await db
            .select({
                id: vendors.id,
                name: vendors.name,
                email: vendors.email,
                status: vendors.status,
            })
            .from(vendors)
            .where(eq(vendors.id, vendorId))
            .limit(1);

        if (!targetVendor) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Vendor not found",
                },
                { status: 404 }
            );
        }

        // 6.1 Reject vendor (pending vendors only)
        if (action === "reject") {
            if (targetVendor.status !== "pending") {
                return NextResponse.json(
                    {
                        success: false,
                        message: `Vendor cannot be rejected because its status is ${targetVendor.status}`,
                    },
                    { status: 409 }
                );
            }

            const [rejectedVendor] = await db
                .update(vendors)
                .set({
                    status: "rejected",
                    isActive: false,
                    statusReason: reason,
                    updatedAt: new Date(),
                })
                .where(
                    and(
                        eq(vendors.id, vendorId),
                        eq(vendors.status, "pending")
                    )
                )
                .returning({
                    id: vendors.id,
                    name: vendors.name,
                    email: vendors.email,
                    status: vendors.status,
                    isActive: vendors.isActive,
                    // statusReason: vendors.statusReason,
                });

            if (!rejectedVendor) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Vendor was already processed. Refresh and try again.",
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json(
                {
                    success: true,
                    message: "Vendor rejected successfully",
                    vendor: rejectedVendor,
                },
                { status: 200 }
            );
        }

        // 7. Only pending vendors can be approved
        if (targetVendor.status !== "pending") {
            return NextResponse.json(
                {
                    success: false,
                    message: `Vendor cannot be approved because its status is ${targetVendor.status}`,
                },
                { status: 409 }
            );
        }

        // 8. Approve vendor
        // The conditional update prevents approving the same pending
        // vendor twice if two requests arrive at the same time.
        const [approvedVendor] = await db
            .update(vendors)
            .set({
                status: "approved",
                isActive: true,
                approvedBy: currentAdmin.id,
                approvedAt: new Date(),
                updatedAt: new Date(),
            })
            .where(
                and(
                    eq(vendors.id, vendorId),
                    eq(vendors.status, "pending")
                )
            )
            .returning({
                id: vendors.id,
                name: vendors.name,
                email: vendors.email,
                mobileNumber: vendors.mobileNumber,
                status: vendors.status,
                isActive: vendors.isActive,
                approvedBy: vendors.approvedBy,
                approvedAt: vendors.approvedAt,
            });

        if (!approvedVendor) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Vendor was already processed. Refresh and try again.",
                },
                { status: 409 }
            );
        }

        // 9. Success
        return NextResponse.json(
            {
                success: true,
                message: "Vendor approved successfully",
                vendor: approvedVendor,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("VENDOR_APPROVE_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}












// import { NextRequest, NextResponse } from "next/server";
// import { jwtVerify } from "jose";
// import { and, eq } from "drizzle-orm";

// import { db } from "@/app/api/lib/db";
// import { adminAccounts } from "@/app/api/lib/schema/admin-schema";
// import { vendors } from "@/app/api/lib/schema/vendor";

// type AdminJwtPayload = {
//     adminId: string;
//     role: string;
//     email: string;
// };

// export async function PATCH(
//     request: NextRequest,
//     { params }: { params: Promise<{ vendorId: string }> }
// ) {
//     try {
//         // 1. Get vendor ID
//         const { vendorId } = await params;

//         if (
//             !vendorId ||
//             !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(vendorId)
//         ) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "A valid vendor ID is required",
//                 },
//                 { status: 400 }
//             );
//         }

//         // 2. Read admin JWT cookie
//         const token = request.cookies.get("admin_token")?.value;

//         if (!token) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Authentication required",
//                 },
//                 { status: 401 }
//             );
//         }

//         // 3. Verify JWT
//         const secret = process.env.JWT_SECRET;

//         if (!secret) {
//             console.error("JWT_SECRET is not configured");

//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Server configuration error",
//                 },
//                 { status: 500 }
//             );
//         }

//         let payload: AdminJwtPayload;

//         try {
//             const { payload: verifiedPayload } = await jwtVerify(
//                 token,
//                 new TextEncoder().encode(secret)
//             );

//             payload = verifiedPayload as unknown as AdminJwtPayload;
//         } catch {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Invalid or expired authentication token",
//                 },
//                 { status: 401 }
//             );
//         }

//         if (!payload.adminId || !payload.role) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Invalid admin token payload",
//                 },
//                 { status: 401 }
//             );
//         }

//         // 4. Confirm the admin exists and is active
//         const [currentAdmin] = await db
//             .select({
//                 id: adminAccounts.id,
//                 role: adminAccounts.role,
//                 isActive: adminAccounts.isActive,
//             })
//             .from(adminAccounts)
//             .where(eq(adminAccounts.id, payload.adminId))
//             .limit(1);

//         if (
//             !currentAdmin ||
//             !currentAdmin.isActive ||
//             currentAdmin.role !== payload.role
//         ) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Admin account is not authorized",
//                 },
//                 { status: 403 }
//             );
//         }

//         // 5. Both admin and super_admin can approve vendors
//         if (
//             currentAdmin.role !== "admin" &&
//             currentAdmin.role !== "super_admin"
//         ) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Only admin or super_admin can approve vendors",
//                 },
//                 { status: 403 }
//             );
//         }

//         // 6. Find the vendor
//         const [targetVendor] = await db
//             .select({
//                 id: vendors.id,
//                 name: vendors.name,
//                 email: vendors.email,
//                 status: vendors.status,
//             })
//             .from(vendors)
//             .where(eq(vendors.id, vendorId))
//             .limit(1);

//         if (!targetVendor) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Vendor not found",
//                 },
//                 { status: 404 }
//             );
//         }

//         // 7. Only pending vendors can be approved
//         if (targetVendor.status !== "pending") {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: `Vendor cannot be approved because its status is ${targetVendor.status}`,
//                 },
//                 { status: 409 }
//             );
//         }

//         // 8. Approve vendor
//         // The conditional update prevents approving the same pending
//         // vendor twice if two requests arrive at the same time.
//         const [approvedVendor] = await db
//             .update(vendors)
//             .set({
//                 status: "approved",
//                 isActive: true,
//                 approvedBy: currentAdmin.id,
//                 approvedAt: new Date(),
//                 updatedAt: new Date(),
//             })
//             .where(
//                 and(
//                     eq(vendors.id, vendorId),
//                     eq(vendors.status, "pending")
//                 )
//             )
//             .returning({
//                 id: vendors.id,
//                 name: vendors.name,
//                 email: vendors.email,
//                 mobileNumber: vendors.mobileNumber,
//                 status: vendors.status,
//                 isActive: vendors.isActive,
//                 approvedBy: vendors.approvedBy,
//                 approvedAt: vendors.approvedAt,
//             });

//         if (!approvedVendor) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Vendor was already processed. Refresh and try again.",
//                 },
//                 { status: 409 }
//             );
//         }

//         // 9. Success
//         return NextResponse.json(
//             {
//                 success: true,
//                 message: "Vendor approved successfully",
//                 vendor: approvedVendor,
//             },
//             { status: 200 }
//         );
//     } catch (error) {
//         console.error("VENDOR_APPROVE_ERROR:", error);

//         return NextResponse.json(
//             {
//                 success: false,
//                 message: "Internal server error",
//             },
//             { status: 500 }
//         );
//     }
// }

