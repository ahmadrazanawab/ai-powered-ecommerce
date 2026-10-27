
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { and, eq, isNull, desc, ilike, or, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { otpCodes } from "@/app/api/lib/schema/user_otp";
import { userOtpRequestSchema } from "@/app/api/lib/validations/user";
import { requireAdmin } from "@/app/api/auth/admin/lib/require-admin";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
    try {
        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                { success: false, message: "Invalid JSON body" },
                { status: 400 }
            );
        }

        const validation = userOtpRequestSchema.safeParse(body);

        if (!validation.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid request data",
                    errors: validation.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { identifier, purpose } = validation.data;
        const isEmail = identifier.includes("@");

        const otpSecret = process.env.OTP_HASH_SECRET;

        if (!otpSecret || otpSecret.length < 32) {
            console.error(
                "OTP_HASH_SECRET is missing or too short"
            );

            return NextResponse.json(
                { success: false, message: "Server configuration error" },
                { status: 500 }
            );
        }

        const [existingUser] = await db
            .select({
                id: users.id,
                isBlocked: users.isBlocked,
                deletedAt: users.deletedAt,
            })
            .from(users)
            .where(
                isEmail
                    ? eq(users.email, identifier)
                    : eq(users.mobileNo, identifier)
            )
            .limit(1);

        if (existingUser && (existingUser.deletedAt || existingUser.isBlocked)) {
            return NextResponse.json(
                { success: false, message: "This account cannot log in. Contact support." },
                { status: 403 }
            );
        }

        if (purpose === "signup" && existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: "An account already exists. Please log in.",
                },
                { status: 409 }
            );
        }

        if (purpose === "login" && !existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No account found. Please sign up first.",
                },
                { status: 404 }
            );
        }

        const otp = randomInt(0, 1_000_000)
            .toString()
            .padStart(6, "0");

        const codeHash = createHash("sha256")
            .update(
                `${otpSecret}:${identifier}:${purpose}:${otp}`
            )
            .digest("hex");

        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // Invalidate previous unused OTPs for this purpose.
        await db
            .update(otpCodes)
            .set({ usedAt: new Date() })
            .where(
                and(
                    eq(otpCodes.identifier, identifier),
                    eq(otpCodes.purpose, purpose),
                    isNull(otpCodes.usedAt)
                )
            );

        await db.insert(otpCodes).values({
            identifier,
            codeHash,
            purpose,
            expiresAt,
        });

        if (process.env.NODE_ENV !== "production") {
            console.log(
                `[CUSTOMER OTP - DEVELOPMENT] ${identifier}: ${otp}`
            );
        }

        // TODO: send the OTP using your email/SMS provider.
        return NextResponse.json(
            {
                success: true,
                message:
                    "OTP generated. Check the server terminal during development.",
                expiresIn: 300,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("CUSTOMER_REQUEST_OTP_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}






const MAX_LIMIT = 50;

// GET /api/auth/admin/users?page=1&limit=10&search=&status=all|active|blocked
export async function GET(request: NextRequest) {
    try {
        const auth = await requireAdmin(request); // admin + super_admin
        if (!auth.ok) return auth.response;

        const params = request.nextUrl.searchParams;
        const page = Math.max(1, Number.parseInt(params.get("page") ?? "1", 10) || 1);
        const limit = Math.min(
            MAX_LIMIT,
            Math.max(1, Number.parseInt(params.get("limit") ?? "10", 10) || 10)
        );
        const search = (params.get("search") ?? "").trim().slice(0, 100);
        const status = params.get("status") ?? "all";

        const conditions = [isNull(users.deletedAt)];
        if (status === "active") conditions.push(eq(users.isBlocked, false));
        if (status === "blocked") conditions.push(eq(users.isBlocked, true));
        if (search) {
            const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`; // escape LIKE wildcards
            conditions.push(
                or(
                    ilike(users.name, pattern),
                    ilike(users.email, pattern),
                    ilike(users.mobileNo, pattern)
                )!
            );
        }
        const where = and(...conditions);

        const [[filtered], [overall], rows] = await Promise.all([
            db.select({ total: sql<number>`count(*)::int` }).from(users).where(where),
            db
                .select({
                    total: sql<number>`count(*)::int`,
                    blocked: sql<number>`(count(*) filter (where ${users.isBlocked}))::int`,
                    newThisWeek: sql<number>`(count(*) filter (where ${users.createdAt} >= now() - interval '7 days'))::int`,
                })
                .from(users)
                .where(isNull(users.deletedAt)),
            db
                .select({
                    userId: users.id,
                    name: users.name,
                    email: users.email,
                    mobileNo: users.mobileNo,
                    isVerified: users.isVerified,
                    isBlocked: users.isBlocked,
                    blockedReason: users.blockedReason,
                    blockedAt: users.blockedAt,
                    lastLoginAt: users.lastLoginAt,
                    createdAt: users.createdAt,
                })
                .from(users)
                .where(where)
                .orderBy(desc(users.createdAt))
                .limit(limit)
                .offset((page - 1) * limit),
        ]);

        return NextResponse.json({
            success: true,
            message: "Customers fetched successfully",
            users: rows,
            pagination: {
                page,
                limit,
                total: filtered.total,
                totalPages: Math.max(1, Math.ceil(filtered.total / limit)),
            },
            stats: {
                total: overall.total,
                active: overall.total - overall.blocked,
                blocked: overall.blocked,
                newThisWeek: overall.newThisWeek,
            },
        });
    } catch (error) {
        console.error("ADMIN_GET_USERS_ERROR:", error);
        return NextResponse.json(
            { success: false, message: "Internal server error" },
            { status: 500 }
        );
    }
}


