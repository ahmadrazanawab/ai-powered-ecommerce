import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";

export type AdminRole = "admin" | "super_admin";

type AdminAuthResult =
    | { ok: true; admin: { id: string; role: AdminRole } }
    | { ok: false; response: NextResponse };

const fail = (message: string, status: number): AdminAuthResult => ({
    ok: false,
    response: NextResponse.json({ success: false, message }, { status }),
});

/**
 * Verifies the admin_token cookie AND re-checks the admin in the database
 * (active + role still matches). Pass ["super_admin"] to restrict a route.
 */
export async function requireAdmin(
    request: NextRequest,
    allowedRoles: readonly AdminRole[] = ["admin", "super_admin"]
): Promise<AdminAuthResult> {
    const token = request.cookies.get("admin_token")?.value;
    if (!token) return fail("Authentication required", 401);

    const secret = process.env.JWT_SECRET;
    if (!secret) {
        console.error("JWT_SECRET is not configured");
        return fail("Server configuration error", 500);
    }

    let adminId: string;
    let role: string;
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
            algorithms: ["HS256"],
        });
        if (
            typeof payload.adminId !== "string" ||
            !payload.adminId.trim() ||
            typeof payload.role !== "string" ||
            !payload.role.trim()
        ) {
            return fail("Invalid admin token payload", 401);
        }
        adminId = payload.adminId;
        role = payload.role;
    } catch {
        return fail("Invalid or expired authentication token", 401);
    }

    const [admin] = await db
        .select({
            id: adminAccounts.id,
            role: adminAccounts.role,
            isActive: adminAccounts.isActive,
        })
        .from(adminAccounts)
        .where(eq(adminAccounts.id, adminId))
        .limit(1);

    if (!admin || !admin.isActive || admin.role !== role) {
        return fail("Admin account is not authorized", 403);
    }

    if (!allowedRoles.includes(admin.role as AdminRole)) {
        return fail("You do not have permission to perform this action", 403);
    }

    return { ok: true, admin: { id: admin.id, role: admin.role as AdminRole } };
}