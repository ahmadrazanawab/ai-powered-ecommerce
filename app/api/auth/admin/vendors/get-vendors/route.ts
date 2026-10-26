
import { NextResponse, NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";
import { vendors } from "@/app/api/lib/schema/vendor";

const ALLOWED_ADMIN_ROLES = ["admin", "super_admin"] as const;

type AdminJwtPayload = {
    adminId: string;
    role: string;
};

export async function GET(request: NextRequest) {
    try {
        // 1. Read admin authentication cookie
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

        // 2. Validate server configuration
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

        // 3. Verify JWT signature and validate payload
        let payload: AdminJwtPayload;

        try {
            const { payload: verifiedPayload } = await jwtVerify(
                token,
                new TextEncoder().encode(secret),
                {
                    algorithms: ["HS256"],
                }
            );

            if (
                typeof verifiedPayload.adminId !== "string" ||
                !verifiedPayload.adminId.trim() ||
                typeof verifiedPayload.role !== "string" ||
                !verifiedPayload.role.trim()
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid admin token payload",
                    },
                    { status: 401 }
                );
            }

            payload = {
                adminId: verifiedPayload.adminId,
                role: verifiedPayload.role,
            };
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid or expired authentication token",
                },
                { status: 401 }
            );
        }

        // 4. Fetch the current admin account
        const [currentAdmin] = await db
            .select({
                id: adminAccounts.id,
                role: adminAccounts.role,
                isActive: adminAccounts.isActive,
            })
            .from(adminAccounts)
            .where(eq(adminAccounts.id, payload.adminId))
            .limit(1);

        // 5. Verify account status and token consistency
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

        // 6. Authorize admin roles
        if (
            !ALLOWED_ADMIN_ROLES.includes(
                currentAdmin.role as (typeof ALLOWED_ADMIN_ROLES)[number]
            )
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Only admin or super_admin can access vendors",
                },
                { status: 403 }
            );
        }

        // 7. Fetch vendor details
        const vendorDetails = await db
            .select({
                vendorId: vendors.id,
                name: vendors.name,
                email: vendors.email,
                status: vendors.status,
                isActive: vendors.isActive,
            })
            .from(vendors);

        // 8. Return successful response
        return NextResponse.json({
            success: true,
            message: "All vendors fetched successfully",
            vendorDetails,
        });
    } catch (error) {
        console.error("GET_VENDOR_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
