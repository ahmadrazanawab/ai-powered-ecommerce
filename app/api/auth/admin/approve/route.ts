import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";
import { jwtVerify } from "jose";
import { eq,and } from "drizzle-orm";
type AdminJwtPayload = {
    adminId: string;
    role: string;
    email: string;
};

export async function GET(request: NextRequest) {
    try {

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
                    message: "Only super_admin can see admins",
                },
                { status: 403 }
            );
        }

    
        // Fetch all pending admin accounts
        const getAdminDetails = await db
            .select({
                adminId: adminAccounts.id,
                name: adminAccounts.name,
                email: adminAccounts.email,
                role: adminAccounts.role,
                status: adminAccounts.status,
                isVerified: adminAccounts.isVerified,
                isActive: adminAccounts.isActive,
            })
            .from(adminAccounts)
            .where(
                and(
                    eq(adminAccounts.role, "admin")
                )
            );

        return NextResponse.json({
            success: true,
            message: "Pending admins fetched successfully",
            adminDetails: getAdminDetails,
        });
    } catch (error) {
        console.error("ADMIN_APPROVE_DETAILS_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
