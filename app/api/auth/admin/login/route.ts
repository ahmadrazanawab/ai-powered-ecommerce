

import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";

import { db } from "@/app/api/lib/db";
import { adminAccounts } from "@/app/api/lib/schema/admin-schema";

import { adminLoginSchema } from "@/app/api/lib/validations/admin";

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
        // 2. Zod validation
        // -----------------------------

        const result = adminLoginSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid login data",
                    errors: result.error.flatten().fieldErrors,
                },
                { status: 400 }
            );
        }

        const { email, password } = result.data;

        // -----------------------------
        // 3. Find admin
        // -----------------------------

        const [admin] = await db
            .select({
                id: adminAccounts.id,
                email: adminAccounts.email,
                passwordHash: adminAccounts.passwordHash,
                role: adminAccounts.role,
                isActive: adminAccounts.isActive,
            })
            .from(adminAccounts)
            .where(eq(adminAccounts.email, email))
            .limit(1);

        // -----------------------------
        // 4. Invalid credentials
        // -----------------------------

        if (!admin) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                { status: 401 }
            );
        }

        // -----------------------------
        // 5. Check active status
        // -----------------------------

        if (!admin.isActive) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Admin account is inactive",
                },
                { status: 403 }
            );
        }

        // -----------------------------
        // 6. Compare password
        // -----------------------------

        const passwordMatches = await bcrypt.compare(
            password,
            admin.passwordHash
        );

        if (!passwordMatches) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid email or password",
                },
                { status: 401 }
            );
        }


        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        // -----------------------------
        // 7. Admin jwt 
        // -----------------------------

        const token = await new SignJWT({
            adminId: admin.id,
            role: admin.role,
            email: admin.email,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1d")
            .sign(new TextEncoder().encode(secret));

        // -----------------------------
        // 7. Admin authenticated
        // -----------------------------
        const response = NextResponse.json(
            {
                success: true,
                message: "Admin authentication successful",
                admin: {
                    id: admin.id,
                    email: admin.email,
                    role: admin.role,
                },
            },
            { status: 200 }
        );

        response.cookies.set("admin_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 1 day
            path: "/",
        });

        return response;
    
    } catch (error) {
        console.error("ADMIN_LOGIN_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}