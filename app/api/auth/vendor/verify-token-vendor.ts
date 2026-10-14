
import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

export interface AdminTokenPayload {
    vendorId: string;
    email?: string;
}

export async function verifyAdminToken(request: NextRequest): Promise<
    | { success: true; payload: AdminTokenPayload }
    | { success: false; response: NextResponse }
> {
    const token = request.cookies.get("vendor_token")?.value;

    if (!token) {
        return {
            success: false,
            response: NextResponse.json(
                { success: false, message: "Authentication required" },
                { status: 401 }
            ),
        };
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error("JWT_SECRET is not configured");
    }

    try {
        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(secret),
            { algorithms: ["HS256"] }
        );

        if (
            typeof payload.vendorId !== "string"
        ) {
            return {
                success: false,
                response: NextResponse.json(
                    { success: false, message: "Invalid token payload" },
                    { status: 401 }
                ),
            };
        }

        return {
            success: true,
            payload: {
                vendorId: payload.vendorId,
                ...(typeof payload.email === "string"
                    ? { email: payload.email }
                    : {}),
            },
        };
    } catch {
        return {
            success: false,
            response: NextResponse.json(
                { success: false, message: "Invalid or expired token" },
                { status: 401 }
            ),
        };
    }
}
