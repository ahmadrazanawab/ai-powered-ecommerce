import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { vendors } from "@/app/api/lib/schema/vendor";
import { verifyAdminToken } from "@/app/api/auth/admin/verify-token";

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ vendorId: string }> }
) {
    try {
        // 1. Verify admin JWT
        const auth = await verifyAdminToken(request);

        if (!auth.success) {
            return auth.response;
        }

        // 2. Check admin permissions
        const allowedRoles = ["admin", "super_admin"];

        if (!allowedRoles.includes(auth.payload.role)) {
            return NextResponse.json(
                {
                    success: false,
                    message: "You do not have permission to manage vendors",
                },
                { status: 403 }
            );
        }

        // 3. Get vendor ID
        const { vendorId } = await params;

        // 4. Parse request body
        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid JSON body" },
                { status: 400 }
            );
        }

        if (
            typeof body !== "object" ||
            body === null ||
            !("action" in body) ||
            (body.action !== "suspend" &&
                body.action !== "reactivate" &&
                body.action !== "deactivate")
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Action must be suspend, deactivate or reactivate",
                },
                { status: 400 }
            );
        }

        const action = body.action;

        // 4.1 Optional reason (stored for suspend and deactivate)
        const reason =
            "reason" in body && typeof body.reason === "string"
                ? body.reason.trim()
                : "";

        if (reason.length > 500) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Reason must be 500 characters or fewer",
                },
                { status: 400 }
            );
        }

        // 5. Find vendor
        const [vendor] = await db
            .select({
                id: vendors.id,
                name: vendors.name,
                status: vendors.status,
                isActive: vendors.isActive,
                approvedAt: vendors.approvedAt,
            })
            .from(vendors)
            .where(eq(vendors.id, vendorId))
            .limit(1);

        if (!vendor) {
            return NextResponse.json(
                { success: false, message: "Vendor not found" },
                { status: 404 }
            );
        }

        // 6. Suspend vendor
        if (action === "suspend") {
            if (vendor.status !== "approved") {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Only approved vendors can be suspended",
                    },
                    { status: 409 }
                );
            }

            const [updatedVendor] = await db
                .update(vendors)
                .set({
                    status: "suspended",
                    isActive: false,
                    statusReason: reason || null,
                    updatedAt: new Date(),
                })
                .where(eq(vendors.id, vendorId))
                .returning({
                    id: vendors.id,
                    name: vendors.name,
                    status: vendors.status,
                    isActive: vendors.isActive,
                });

            return NextResponse.json(
                {
                    success: true,
                    message: "Vendor suspended successfully",
                    data: updatedVendor,
                },
                { status: 200 }
            );
        }

        // 7. Deactivate vendor
        // Deactivate keeps the vendor approved but switches it off (isActive = false).
        if (action === "deactivate") {
            if (vendor.status !== "approved" || !vendor.isActive ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Only active, approved vendors can be deactivated",
                    },
                    { status: 409 }
                );
            }

            const [updatedVendor] = await db
                .update(vendors)
                .set({
                    isActive: false,
                    statusReason: reason || null,
                    updatedAt: new Date(),
                })
                .where(eq(vendors.id, vendorId))
                .returning({
                    id: vendors.id,
                    name: vendors.name,
                    status: vendors.status,
                    isActive: vendors.isActive,
                });

            return NextResponse.json(
                {
                    success: true,
                    message: "Vendor deactivated successfully",
                    data: updatedVendor,
                },
                { status: 200 }
            );
        }

        // 8. Reactivate vendor
        // Works for a suspended vendor (that was approved before)
        // and for a deactivated vendor (approved but inactive).
        const isSuspended = vendor.status === "suspended" && Boolean(vendor.approvedAt);
        const isDeactivated = vendor.status === "approved" && !vendor.isActive;

        if (!isSuspended && !isDeactivated) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Only previously approved, suspended or deactivated vendors can be reactivated",
                },
                { status: 409 }
            );
        }

        const [updatedVendor] = await db
            .update(vendors)
            .set({
                status: "approved",
                isActive: true,
                statusReason: null,
                updatedAt: new Date(),
            })
            .where(eq(vendors.id, vendorId))
            .returning({
                id: vendors.id,
                name: vendors.name,
                status: vendors.status,
                isActive: vendors.isActive,
            });

        return NextResponse.json(
            {
                success: true,
                message: "Vendor reactivated successfully",
                data: updatedVendor,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("UPDATE_VENDOR_STATUS_ERROR:", error);

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
// import { eq } from "drizzle-orm";

// import { db } from "@/app/api/lib/db";
// import { vendors } from "@/app/api/lib/schema/vendor";
// import { verifyAdminToken } from "@/app/api/auth/admin/verify-token";

// export async function PATCH(
//   request: NextRequest,
//   { params }: { params: Promise<{ vendorId: string }> }
// ) {
//   try {
//     // 1. Verify admin JWT
//     const auth = await verifyAdminToken(request);

//     if (!auth.success) {
//       return auth.response;
//     }

//     // 2. Check admin permissions
//     const allowedRoles = ["admin", "super_admin"];

//     if (!allowedRoles.includes(auth.payload.role)) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "You do not have permission to manage vendors",
//         },
//         { status: 403 }
//       );
//     }

//     // 3. Get vendor ID
//     const { vendorId } = await params;

//     // 4. Parse request body
//     let body: unknown;

//     try {
//       body = await request.json();
//     } catch {
//       return NextResponse.json(
//         { success: false, message: "Invalid JSON body" },
//         { status: 400 }
//       );
//     }

//     if (
//       typeof body !== "object" ||
//       body === null ||
//       !("action" in body) ||
//       (body.action !== "suspend" && body.action !== "reactivate")
//     ) {
//       return NextResponse.json(
//         {
//           success: false,
//           message: "Action must be suspend or reactivate",
//         },
//         { status: 400 }
//       );
//     }

//     const action = body.action;

//     // 5. Find vendor
//     const [vendor] = await db
//       .select({
//         id: vendors.id,
//         name: vendors.name,
//         status: vendors.status,
//         isActive: vendors.isActive,
//         approvedAt: vendors.approvedAt,
//       })
//       .from(vendors)
//       .where(eq(vendors.id, vendorId))
//       .limit(1);

//     if (!vendor) {
//       return NextResponse.json(
//         { success: false, message: "Vendor not found" },
//         { status: 404 }
//       );
//     }

//     // 6. Suspend vendor
//     if (action === "suspend") {
//       if (vendor.status !== "approved") {
//         return NextResponse.json(
//           {
//             success: false,
//             message: "Only approved vendors can be suspended",
//           },
//           { status: 409 }
//         );
//       }

//       const [updatedVendor] = await db
//         .update(vendors)
//         .set({
//           status: "suspended",
//           isActive: false,
//           updatedAt: new Date(),
//         })
//         .where(eq(vendors.id, vendorId))
//         .returning({
//           id: vendors.id,
//           name: vendors.name,
//           status: vendors.status,
//           isActive: vendors.isActive,
//         });

//       return NextResponse.json(
//         {
//           success: true,
//           message: "Vendor suspended successfully",
//           data: updatedVendor,
//         },
//         { status: 200 }
//       );
//     }

//     // 7. Reactivate vendor
//     if (vendor.status !== "suspended" || !vendor.approvedAt) {
//       return NextResponse.json(
//         {
//           success: false,
//           message:
//             "Only previously approved, suspended vendors can be reactivated",
//         },
//         { status: 409 }
//       );
//     }

//     const [updatedVendor] = await db
//       .update(vendors)
//       .set({
//         status: "approved",
//         isActive: true,
//         updatedAt: new Date(),
//       })
//       .where(eq(vendors.id, vendorId))
//       .returning({
//         id: vendors.id,
//         name: vendors.name,
//         status: vendors.status,
//         isActive: vendors.isActive,
//       });

//     return NextResponse.json(
//       {
//         success: true,
//         message: "Vendor reactivated successfully",
//         data: updatedVendor,
//       },
//       { status: 200 }
//     );
//   } catch (error) {
//     console.error("UPDATE_VENDOR_STATUS_ERROR:", error);

//     return NextResponse.json(
//       {
//         success: false,
//         message: "Internal server error",
//       },
//       { status: 500 }
//     );
//   }
// }
