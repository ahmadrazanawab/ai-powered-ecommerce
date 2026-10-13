
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "crypto";
import { eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { otpCodes } from "@/app/api/lib/schema/user_otp";
import { userOtpRequestSchema } from "@/app/api/lib/validations/user";

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

        // 2. Validate input using Zod
        const result = userOtpRequestSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid request data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { identifier, purpose } = result.data;

        // 3. Check whether the customer exists
        const isEmail = identifier.includes("@");

        const [existingUser] = await db
            .select({
                id: users.id,
                email: users.email,
                mobileNumber: users.mobileNo,
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
                    message:
                        "An account already exists. Please log in.",
                },
                { status: 409 }
            );
        }

        if (purpose === "login" && !existingUser) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "No account found. Please sign up first.",
                },
                { status: 404 }
            );
        }

        // 4. Generate a cryptographically secure 6-digit OTP
        const otp = randomInt(0, 1_000_000)
            .toString()
            .padStart(6, "0");

        // 5. Hash the OTP before saving it
        const otpSecret = process.env.OTP_HASH_SECRET;

        if (!otpSecret) {
            console.error("OTP_HASH_SECRET is not configured");

            return NextResponse.json(
                {
                    success: false,
                    message: "Server configuration error",
                },
                { status: 500 }
            );
        }

        const codeHash = createHash("sha256")
            .update(`${otpSecret}:${identifier}:${purpose}:${otp}`)
            .digest("hex");

        // 6. Set OTP expiry (5 minutes)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 7. Save OTP hash in PostgreSQL
        await db.insert(otpCodes).values({
            identifier,
            codeHash,
            purpose,
            expiresAt,
        });

        // 8. Development only: print OTP to server terminal
        if (process.env.NODE_ENV !== "production") {
            console.log(
                `[CUSTOMER OTP - DEVELOPMENT] ${identifier}: ${otp}`
            );
        }

        // TODO: Send OTP by email or SMS when delivery is integrated.

        return NextResponse.json(
            {
                success: true,
                message: "OTP generated successfully. Check server terminal during development.",
                expiresIn: 300,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("CUSTOMER_REQUEST_OTP_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
