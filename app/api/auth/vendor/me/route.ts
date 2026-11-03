import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { jwtVerify } from "jose";

import { vendors } from "@/app/api/lib/schema/vendor";
import { db } from "@/app/api/lib/db";

export async function GET(req: NextRequest) {
    try {
        // 1. Get vendor token from HTTP-only cookie
        const token = req.cookies.get("vendor_token")?.value;

        if (!token) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Vendor authentication required",
                },
                { status: 401 }
            );
        }

        // 2. Verify JWT
        const secret = process.env.JWT_SECRET;

        if (!secret) {
            throw new Error("JWT_SECRET is not configured");
        }

        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(secret),
            {
                algorithms: ["HS256"],
            }
        );

        // 3. Extract vendor ID
        const vendorId = payload.vendorId;

        if (typeof vendorId !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid vendor token",
                },
                { status: 401 }
            );
        }

        // 4. Fetch vendor from database
        const [vendor] = await db
            .select({
                vendorId: vendors.id,
                name:vendors.name,
                email: vendors.email,
                isActive: vendors.isActive,
            })
            .from(vendors)
            .where(eq(vendors.id, vendorId))
            .limit(1);

        // 5. Check vendor existence
        if (!vendor) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Vendor not found",
                },
                { status: 404 }
            );
        }

        // 6. Check vendor active status
        if (!vendor.isActive) {
            const response = NextResponse.json(
                {
                    success: false,
                    message: "Vendor account is inactive",
                },
                { status: 403 }
            );

            response.cookies.set("vendor_token", "", {
                httpOnly: true,
                secure: process.env.NODE_ENV === "production",
                sameSite: "lax",
                path: "/",
                maxAge: 0,
            });

            return response;
        }

        // 7. Return authenticated vendor
        return NextResponse.json(
            {
                success: true,
                message: "Vendor fetched successfully",
                data: vendor,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("VENDOR_ME_ERROR:", error);

        // Invalid or expired JWT
        if (
            error instanceof Error &&
            (error.name === "JWTExpired" ||
                error.name === "JWTInvalid" ||
                error.name === "JWSInvalid" ||
                error.name === "JWSSignatureVerificationFailed")
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid or expired vendor session",
                },
                { status: 401 }
            );
        }

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}
