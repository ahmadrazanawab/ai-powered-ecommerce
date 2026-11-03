// FILE: app/api/auth/admin/profile/route.ts   (replaces the previous version)
// GET   -> the logged-in admin's profile                       (unchanged)
// POST  -> step 1 of a password change: check the passwords, create + "send" an OTP
// PATCH -> step 2 of a password change: needs the OTP, then saves the new password
//


import { createHmac, randomInt, timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";

import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";
import { verifyAdminToken } from "../verify-token";

export const runtime = "nodejs";

const ALLOWED_ROLES = ["admin", "super_admin"];
const OTP_PURPOSE = "admin_password_otp";
const OTP_EXPIRES_IN = "10m";

const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, "Current password is required"),
    // bcrypt only uses the first 72 bytes, so longer passwords are rejected
    newPassword: z
        .string()
        .min(8, "New password must be at least 8 characters")
        .max(72, "New password must be at most 72 characters"),
});

const otpSchema = z.object({
    otp: z.string().regex(/^\d{6}$/, "Enter the 6-digit code"),
    otpToken: z.string().min(1, "Verification code is required"),
});

/* ------------------------------------------------------------------ */
/* OTP helpers                                                         */
/* ------------------------------------------------------------------ */

// separate key, so an OTP token can never be accepted as an admin login token
function getOtpKey() {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }

    return new TextEncoder().encode(`${secret}:admin-password-otp`);
}

function computeOtpMac(input: {
    adminId: string;
    otp: string;
    newPassword: string;
    passwordHash: string;
}) {
    return createHmac("sha256", getOtpKey())
        .update([input.adminId, input.otp, input.newPassword, input.passwordHash].join("\u0000"))
        .digest("hex");
}

function safeEqual(a: string, b: string) {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

/**
 * Delivers the OTP to the admin.
 * For now it only prints it in the server console.
 * LATER: replace the console.log with nodemailer (transporter.sendMail) and remove the log.
 */
async function sendPasswordOtp(email: string, otp: string) {
    console.log(`[ADMIN_PASSWORD_OTP] email=${email} otp=${otp} (valid for 10 minutes)`);
}

const invalidOtp = () =>
    NextResponse.json(
        {
            success: false,
            message: "Invalid or expired verification code",
            errors: { otp: ["Invalid or expired verification code"] },
        },
        { status: 400 }
    );

/* ------------------------------------------------------------------ */
/* Shared checks for POST and PATCH                                    */
/* ------------------------------------------------------------------ */
async function prepare(request: NextRequest) {
    // 1. Authenticate
    const auth = await verifyAdminToken(request);
    if (!auth.success) return { ok: false as const, response: auth.response };

    if (!ALLOWED_ROLES.includes(auth.payload.role)) {
        return {
            ok: false as const,
            response: NextResponse.json(
                { success: false, message: "You do not have permission to change this password" },
                { status: 403 }
            ),
        };
    }

    // 2. Parse JSON
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return {
            ok: false as const,
            response: NextResponse.json(
                { success: false, message: "Invalid JSON body" },
                { status: 400 }
            ),
        };
    }

    // 3. Validate the passwords
    const result = changePasswordSchema.safeParse(body);

    if (!result.success) {
        return {
            ok: false as const,
            response: NextResponse.json(
                {
                    success: false,
                    message: "Invalid password data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            ),
        };
    }

    const { currentPassword, newPassword } = result.data;

    // 4. Load the admin (with hash)
    const [admin] = await db
        .select({
            id: adminAccounts.id,
            name: adminAccounts.name,
            phoneNumber:adminAccounts.phoneNumber,
            email: adminAccounts.email,
            passwordHash: adminAccounts.passwordHash,
            isActive: adminAccounts.isActive,
        })
        .from(adminAccounts)
        .where(eq(adminAccounts.id, auth.payload.adminId))
        .limit(1);

    if (!admin) {
        return {
            ok: false as const,
            response: NextResponse.json(
                { success: false, message: "Admin account not found" },
                { status: 404 }
            ),
        };
    }

    if (!admin.isActive) {
        return {
            ok: false as const,
            response: NextResponse.json(
                { success: false, message: "Admin account is inactive" },
                { status: 403 }
            ),
        };
    }

    // 5. Check the current password.
    // 400 (not 401) on purpose: a wrong password here should not look like an expired session.
    const currentMatches = await bcrypt.compare(currentPassword, admin.passwordHash);

    if (!currentMatches) {
        return {
            ok: false as const,
            response: NextResponse.json(
                {
                    success: false,
                    message: "Current password is incorrect",
                    errors: { currentPassword: ["Current password is incorrect"] },
                },
                { status: 400 }
            ),
        };
    }

    // 6. New password must be different
    const sameAsOld = await bcrypt.compare(newPassword, admin.passwordHash);

    if (sameAsOld) {
        return {
            ok: false as const,
            response: NextResponse.json(
                {
                    success: false,
                    message: "New password must be different from the current password",
                    errors: {
                        newPassword: ["New password must be different from the current password"],
                    },
                },
                { status: 400 }
            ),
        };
    }

    return { ok: true as const, admin, currentPassword, newPassword, body };
}

/* ------------------------------------------------------------------ */
/* GET: profile                                                        */
/* ------------------------------------------------------------------ */
export async function GET(request: NextRequest) {
    try {
        const auth = await verifyAdminToken(request);
        if (!auth.success) return auth.response;

        if (!ALLOWED_ROLES.includes(auth.payload.role)) {
            return NextResponse.json(
                { success: false, message: "You do not have permission to view this profile" },
                { status: 403 }
            );
        }

        const [admin] = await db
            .select({
                id: adminAccounts.id,
                name: adminAccounts.name,
                phoneNumber:adminAccounts.phoneNumber,
                email: adminAccounts.email,
                role: adminAccounts.role,
                isActive: adminAccounts.isActive,
                // add more columns here if your table has them, e.g. name, createdAt
            })
            .from(adminAccounts)
            .where(eq(adminAccounts.id, auth.payload.adminId))
            .limit(1);

        if (!admin) {
            return NextResponse.json(
                { success: false, message: "Admin account not found" },
                { status: 404 }
            );
        }

        if (!admin.isActive) {
            return NextResponse.json(
                { success: false, message: "Admin account is inactive" },
                { status: 403 }
            );
        }

        return NextResponse.json(
            {
                success: true,
                message: "Admin profile fetched successfully",
                admin,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("GET_ADMIN_PROFILE_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to fetch profile" },
            { status: 500 }
        );
    }
}

/* ------------------------------------------------------------------ */
/* POST: step 1, check passwords and send the OTP                      */
/* ------------------------------------------------------------------ */
export async function POST(request: NextRequest) {
    try {
        const prepared = await prepare(request);
        if (!prepared.ok) return prepared.response;

        const { admin, newPassword } = prepared;

        // 6-digit code
        const otp = String(randomInt(100000, 1000000));

        const otpToken = await new SignJWT({
            purpose: OTP_PURPOSE,
            adminId: admin.id,
            otpMac: computeOtpMac({
                adminId: admin.id,
                otp,
                newPassword,
                passwordHash: admin.passwordHash,
            }),
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime(OTP_EXPIRES_IN)
            .sign(getOtpKey());

        await sendPasswordOtp(admin.email, otp);

        // the OTP itself is never returned to the browser
        return NextResponse.json(
            {
                success: true,
                message: "Verification code sent",
                otpToken,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("SEND_ADMIN_PASSWORD_OTP_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to send verification code" },
            { status: 500 }
        );
    }
}

/* ------------------------------------------------------------------ */
/* PATCH: step 2, change the password (needs a valid OTP)              */
/* ------------------------------------------------------------------ */
export async function PATCH(request: NextRequest) {
    try {
        const prepared = await prepare(request);
        if (!prepared.ok) return prepared.response;

        const { admin, newPassword, body } = prepared;

        // 1. The OTP is required: without it the password is never changed
        const otpResult = otpSchema.safeParse(body);

        if (!otpResult.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Verification code is required",
                    errors: otpResult.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { otp, otpToken } = otpResult.data;

        // 2. The token must be genuine, unexpired and issued for this admin
        let payload: Record<string, unknown>;

        try {
            const verified = await jwtVerify(otpToken, getOtpKey(), { algorithms: ["HS256"] });
            payload = verified.payload;
        } catch {
            return invalidOtp();
        }

        if (
            payload.purpose !== OTP_PURPOSE ||
            payload.adminId !== admin.id ||
            typeof payload.otpMac !== "string"
        ) {
            return invalidOtp();
        }

        // 3. The code must match (and the new password / current hash must be unchanged)
        const expectedMac = computeOtpMac({
            adminId: admin.id,
            otp,
            newPassword,
            passwordHash: admin.passwordHash,
        });

        if (!safeEqual(expectedMac, payload.otpMac)) {
            return invalidOtp();
        }

        // 4. Save the new hash
        const passwordHash = await bcrypt.hash(newPassword, 12);

        await db
            .update(adminAccounts)
            .set({
                passwordHash,
                // updatedAt: new Date(), // uncomment if adminAccounts has an updatedAt column
            })
            .where(eq(adminAccounts.id, admin.id));

        return NextResponse.json(
            { success: true, message: "Password updated successfully" },
            { status: 200 }
        );
    } catch (error) {
        console.error("CHANGE_ADMIN_PASSWORD_ERROR:", error);

        return NextResponse.json(
            { success: false, message: "Failed to update password" },
            { status: 500 }
        );
    }
}
