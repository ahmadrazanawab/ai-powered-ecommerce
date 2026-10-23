import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { eq, and } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";

type AdminJwtPayload = {
    adminId: string;
    role: string;
    email: string;
};

export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ adminId: string }> }
) {
    try {
        // --------------------------------
        // 1. Get target admin ID
        // --------------------------------

        const { adminId } = await params;

        if (!adminId) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Admin ID is required",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 2. Get JWT from cookie
        // --------------------------------

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

        // --------------------------------
        // 3. Verify JWT
        // --------------------------------

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

            payload = verifiedPayload as AdminJwtPayload;
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid or expired authentication token",
                },
                { status: 401 }
            );
        }

        // --------------------------------
        // 4. Only super_admin can approve
        // --------------------------------

        if (payload.role !== "super_admin") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Only super_admin can approve admins",
                },
                { status: 403 }
            );
        }

        // --------------------------------
        // 5. Verify the JWT admin actually
        //    exists and is the active super_admin
        // --------------------------------

        const [superAdmin] = await db
            .select({
                id: adminAccounts.id,
                role: adminAccounts.role,
                isActive: adminAccounts.isActive,
            })
            .from(adminAccounts)
            .where(
                and(
                    eq(adminAccounts.id, payload.adminId),
                    eq(adminAccounts.role, "super_admin"),
                    eq(adminAccounts.isActive, true)
                )
            )
            .limit(1);

        if (!superAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Super admin account is not authorized",
                },
                { status: 403 }
            );
        }

        // --------------------------------
        // 6. Find target admin
        // --------------------------------

        const [targetAdmin] = await db
            .select({
                id: adminAccounts.id,
                name: adminAccounts.name,
                email: adminAccounts.email,
                role: adminAccounts.role,
                status: adminAccounts.status,
                isVerified: adminAccounts.isVerified,
                isActive: adminAccounts.isActive,
            })
            .from(adminAccounts)
            .where(eq(adminAccounts.id, adminId))
            .limit(1);

        if (!targetAdmin) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Admin not found",
                },
                { status: 404 }
            );
        }

        // --------------------------------
        // 7. Target must be a normal admin
        // --------------------------------

        if (targetAdmin.role !== "admin") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Only normal admins can be approved",
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 8. Admin must be pending
        // --------------------------------

        if (targetAdmin.status !== "pending") {
            return NextResponse.json(
                {
                    success: false,
                    message: `Admin account is already ${targetAdmin.status}`,
                },
                { status: 400 }
            );
        }

        // --------------------------------
        // 9. Approve admin
        // --------------------------------

        const [approvedAdmin] = await db
            .update(adminAccounts)
            .set({
                status: "approved",
                isVerified: true,
                isActive: true,
                approvedBy: superAdmin.id,
                approvedAt: new Date(),
                rejectionReason: null,
                updatedAt: new Date(),
            })
            .where(eq(adminAccounts.id, adminId))
            .returning({
                id: adminAccounts.id,
                name: adminAccounts.name,
                email: adminAccounts.email,
                role: adminAccounts.role,
                status: adminAccounts.status,
                isVerified: adminAccounts.isVerified,
                isActive: adminAccounts.isActive,
                approvedBy: adminAccounts.approvedBy,
                approvedAt: adminAccounts.approvedAt,
            });

        // --------------------------------
        // 10. Success
        // --------------------------------

        return NextResponse.json(
            {
                success: true,
                message: "Admin approved successfully",
                admin: approvedAdmin,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("ADMIN_APPROVE_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
