import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";

import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorLoginSchema } from "@/app/api/lib/validations/vendor";
import { db } from "@/app/api/lib/db";



export async function POST(req: NextRequest) {
    try {
        let body: unknown;
        // -----------------------------
        // 1. check request body
        // -----------------------------

        try {
            body = await req.json();
        } catch (error) {
            return NextResponse.json({
                success: false,
                error: "Invalid JSON vendor login data"
            },
                { status: 400 }
            );
        }

        // -----------------------------
        // 2. zod validation 
        // -----------------------------

        const result = vendorLoginSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: "Invalid email and password"
            }, { status: 400 });
        }

        const { email, password } = result.data;
        // -----------------------------
        // 3. find vendor 
        // -----------------------------

        const [vendor] = await db
            .select({
                id: vendors.id,
                email: vendors.email,
                passwordHash: vendors.passwordHash,
                isActive: vendors.isActive
            })
            .from(vendors)
            .where(eq(vendors.email, email))
            .limit(1)

        // -----------------------------
        // 4. Invalid credentials
        // -----------------------------

        if (!vendor) {
            return NextResponse.json({
                success: false,
                error: "Invalid email and password"
            }, { status: 401 });
        }

        // -----------------------------
        // 5. Check active status
        // -----------------------------

        if (!vendor.isActive) {
            return NextResponse.json({
                success: false,
                error: "Vendor account is inactive",
            }, { status: 403 });
        }

        // -----------------------------
        // 5. Compare password
        // -----------------------------
        const passwordMatches = await bcrypt.compare(
            password,
            vendor.passwordHash
        );


        if (!passwordMatches) {
            return NextResponse.json({
                success: false,
                error: "Invalid email and password"
            }, { status: 401 });
        }

        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        // -----------------------------
        // 7. Vendor jwt 
        // -----------------------------

        const token = await new SignJWT({
            vendorId: vendor.id,
            email: vendor.email,
            isActive: vendor.isActive,
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("1d")
            .sign(new TextEncoder().encode(secret));
        
        
         // -----------------------------
        // 7. Vendor authenticated
        // -----------------------------

        const response = NextResponse.json(
            {
                success: true,
                message: "Vendor authentication successful!",
                vendor: {
                    vendorId: vendor.id,
                    email: vendor.email,
                    isActive: vendor.isActive
                }
            },
            { status: 201 }
        );

        response.cookies.set("vendor_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 60 * 60 * 24, // 1 day
            path: "/",
        });

        return response;

    } catch (error) {
        console.error("VENDOR_LOGIN_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}