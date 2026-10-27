import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";

type UserAuthResult =
    | { ok: true; user: { id: string; name: string | null; email: string | null; mobileNo: string | null } }
    | { ok: false; response: NextResponse };

const fail = (message: string, status: number): UserAuthResult => ({
    ok: false,
    response: NextResponse.json({ success: false, message }, { status }),
});

/**
 * Use in EVERY customer route (orders, profile, cart...).
 * The JWT lives 7 days, so a blocked customer's old token would still work
 * unless we re-check the database on each request.
 */
export async function requireUser(request: NextRequest): Promise<UserAuthResult> {
    const token = request.cookies.get("user_token")?.value;
    if (!token) return fail("Authentication required", 401);

    const secret = process.env.JWT_SECRET;
    if (!secret) return fail("Server configuration error", 500);

    let userId: string;
    try {
        const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
            algorithms: ["HS256"],
        });
        if (typeof payload.userId !== "string" || payload.role !== "USER") {
            return fail("Invalid authentication token", 401);
        }
        userId = payload.userId;
    } catch {
        return fail("Invalid or expired authentication token", 401);
    }

    const [user] = await db
        .select({
            id: users.id,
            name: users.name,
            email: users.email,
            mobileNo: users.mobileNo,
            isBlocked: users.isBlocked,
            deletedAt: users.deletedAt,
        })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

    if (!user || user.deletedAt) return fail("Account not found", 401);
    if (user.isBlocked) return fail("Your account has been blocked. Contact support.", 403);

    return { ok: true, user: { id: user.id, name: user.name, email: user.email, mobileNo: user.mobileNo } };
}