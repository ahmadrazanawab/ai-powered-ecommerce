
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { SignJWT } from "jose";
import {
    and,
    desc,
    eq,
    isNull,
    sql,
} from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { otpCodes } from "@/app/api/lib/schema/user_otp";
import { userOtpVerifySchema } from "@/app/api/lib/validations/user";

const MAX_OTP_ATTEMPTS = 5;
const SESSION_DURATION_SECONDS = 7 * 24 * 60 * 60;

export async function POST(request: NextRequest) {
    try {
        // 1. Parse request body
        let body: unknown;

        try {
            body = await request.json();
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid JSON body",
                },
                { status: 400 }
            );
        }

        // 2. Validate input
        const result = userOtpVerifySchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid verification data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { identifier, otp, purpose } = result.data;
        const isEmail = identifier.includes("@");

        // 3. Check required secrets
        const otpSecret = process.env.OTP_HASH_SECRET;
        const jwtSecret = process.env.JWT_SECRET;

        if (!otpSecret || !jwtSecret) {
            console.error(
                "OTP_HASH_SECRET or JWT_SECRET is not configured"
            );

            return NextResponse.json(
                {
                    success: false,
                    message: "Server configuration error",
                },
                { status: 500 }
            );
        }

        // 4. Get the latest unused OTP for this identifier and purpose
        const [otpRecord] = await db
            .select({
                id: otpCodes.id,
                codeHash: otpCodes.codeHash,
                attempts: otpCodes.attempts,
                expiresAt: otpCodes.expiresAt,
                usedAt: otpCodes.usedAt,
            })
            .from(otpCodes)
            .where(
                and(
                    eq(otpCodes.identifier, identifier),
                    eq(otpCodes.purpose, purpose),
                    isNull(otpCodes.usedAt)
                )
            )
            .orderBy(desc(otpCodes.createdAt))
            .limit(1);

        if (!otpRecord) {
            return NextResponse.json(
                {
                    success: false,
                    message: "OTP not found or already used. Request a new OTP.",
                },
                { status: 400 }
            );
        }

        // 5. Check attempt limit
        if (otpRecord.attempts >= MAX_OTP_ATTEMPTS) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Maximum OTP attempts reached. Request a new OTP.",
                },
                { status: 429 }
            );
        }

        // 6. Check expiry
        if (otpRecord.expiresAt.getTime() <= Date.now()) {
            return NextResponse.json(
                {
                    success: false,
                    message: "OTP expired. Request a new OTP.",
                },
                { status: 400 }
            );
        }

        // 7. Hash the submitted OTP using the same method as request-otp
        const submittedHash = createHash("sha256")
            .update(
                `${otpSecret}:${identifier}:${purpose}:${otp}`
            )
            .digest("hex");

        // 8. Compare hashes
        if (submittedHash !== otpRecord.codeHash) {
            await db
                .update(otpCodes)
                .set({
                    attempts: sql`${otpCodes.attempts} + 1`,
                })
                .where(
                    and(
                        eq(otpCodes.id, otpRecord.id),
                        isNull(otpCodes.usedAt),
                        sql`${otpCodes.attempts} < ${MAX_OTP_ATTEMPTS}`
                    )
                );

            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid OTP",
                },
                { status: 400 }
            );
        }

        // 9. Check account according to purpose
        const [existingUser] = await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                mobileNo: users.mobileNo,
            })
            .from(users)
            .where(
                isEmail
                    ? eq(users.email, identifier)
                    : eq(users.mobileNo, identifier)
            )
            .limit(1);

        if (purpose === "signup" && existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Account already exists. Please log in.",
                },
                { status: 409 }
            );
        }

        if (purpose === "login" && !existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Account not found. Please sign up first.",
                },
                { status: 404 }
            );
        }

        // 10. Create a new user for signup, or find existing user for login
        let user = existingUser;

        if (purpose === "signup") {
            const [createdUser] = await db
                .insert(users)
                .values({
                    email: isEmail ? identifier : null,
                    mobileNo: isEmail ? null : identifier,
                    isVerified: true,
                })
                .returning({
                    id: users.id,
                    name: users.name,
                    email: users.email,
                    mobileNo: users.mobileNo,
                });

            user = createdUser;
        }

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Unable to identify customer account",
                },
                { status: 500 }
            );
        }

        // 11. Mark OTP as used.
        // Conditional update helps prevent reusing the same OTP.
        const [consumedOtp] = await db
            .update(otpCodes)
            .set({
                usedAt: new Date(),
            })
            .where(
                and(
                    eq(otpCodes.id, otpRecord.id),
                    isNull(otpCodes.usedAt),
                    sql`${otpCodes.attempts} < ${MAX_OTP_ATTEMPTS}`
                )
            )
            .returning({
                id: otpCodes.id,
            });

        if (!consumedOtp) {
            return NextResponse.json(
                {
                    success: false,
                    message: "OTP has already been used. Request a new OTP.",
                },
                { status: 409 }
            );
        }

        // 12. Create customer session
        const secret = new TextEncoder().encode(jwtSecret);

        const token = await new SignJWT({
            userId: user.id,
            role: "USER",
            email: user.email,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d")
            .sign(secret);

        // 13. Return response and set authentication cookie
        const response = NextResponse.json(
            {
                success: true,
                message:
                    purpose === "signup"
                        ? "Customer signup successful"
                        : "Customer login successful",
                user,
            },
            { status: 200 }
        );

        response.cookies.set("user_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            path: "/",
            maxAge: SESSION_DURATION_SECONDS,
        });

        return response;
    } catch (error) {
        console.error("CUSTOMER_VERIFY_OTP_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}