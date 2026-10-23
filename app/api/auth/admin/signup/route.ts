import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";

import { adminSignupSchema } from "@/app/api/lib/validations/admins/signup";

export async function POST(request: NextRequest) {
    try {
        // -----------------------------
        // 1. Parse JSON
        // -----------------------------

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

        // -----------------------------
        // 2. Validate request
        // -----------------------------

        const result = adminSignupSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid signup data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const {
            name,
            email,
            phoneNumber,
            password,
        } = result.data;

        // -----------------------------
        // 3. Check existing email
        // -----------------------------

        const [existingEmail] = await db
            .select({
                id: adminAccounts.id,
            })
            .from(adminAccounts)
            .where(eq(adminAccounts.email, email))
            .limit(1);

        if (existingEmail) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Admin with this email already exists",
                },
                { status: 409 }
            );
        }

        // -----------------------------
        // 4. Check existing phone
        // -----------------------------

        if (phoneNumber) {
            const [existingPhone] = await db
                .select({
                    id: adminAccounts.id,
                })
                .from(adminAccounts)
                .where(eq(adminAccounts.phoneNumber, phoneNumber))
                .limit(1);

            if (existingPhone) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Admin with this phone number already exists",
                    },
                    { status: 409 }
                );
            }
        }

        // -----------------------------
        // 5. Hash password
        // -----------------------------

        const passwordHash = await bcrypt.hash(password, 12);

        // -----------------------------
        // 6. Create admin
        // -----------------------------

        const [admin] = await db
            .insert(adminAccounts)
            .values({
                name,
                email,
                phoneNumber,
                passwordHash,

                // IMPORTANT:
                // Signup can create only normal admin
                role: "admin",

                // Admin needs approval
                isVerified: false,
                status: "pending",
                isActive: false,
            })
            .returning({
                id: adminAccounts.id,
                name: adminAccounts.name,
                email: adminAccounts.email,
                phoneNumber: adminAccounts.phoneNumber,
                role: adminAccounts.role,
                status: adminAccounts.status,
                isActive: adminAccounts.isActive,
                createdAt: adminAccounts.createdAt,
            });

        // -----------------------------
        // 7. Response
        // -----------------------------

        return NextResponse.json(
            {
                success: true,
                message:
                    "Admin signup successful. Your account is waiting for approval.",
                admin,
            },
            { status: 201 }
        );
    } catch (error) {
        console.error("ADMIN_SIGNUP_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
