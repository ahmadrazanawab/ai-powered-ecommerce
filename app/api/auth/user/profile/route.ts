import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
    userProfiles,
    vendorProfiles,
} from "@/app/api/lib/schema/profile";

import { getUserSession } from "@/app/api/auth/get-session";

import {
    userProfileSchema,
    vendorProfileSchema,
} from "@/app/api/lib/validations/profile";

export async function PATCH(request: NextRequest) {
    try {
        // -----------------------------
        // 1. Authentication
        // -----------------------------

        const session = await getUserSession();

        if (!session) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Authentication required",
                },
                { status: 401 }
            );
        }

        const { userId, role } = session;

        // -----------------------------
        // 2. Parse JSON
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
        // 3. USER
        // -----------------------------

        if (role === "USER") {
            const result = userProfileSchema.safeParse(body);

            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid user profile data",
                        errors: result.error.flatten().fieldErrors,
                    },
                    { status: 400 }
                );
            }

            const data = result.data;

            const updateData: Partial<
                typeof userProfiles.$inferInsert
            > = {
                updatedAt: new Date(),
            };

            if (data.fullName !== undefined) {
                updateData.fullName = data.fullName;
            }

            if (data.shippingAddress !== undefined) {
                updateData.shippingAddress = data.shippingAddress;
            }

            const [updatedProfile] = await db
                .update(userProfiles)
                .set(updateData)
                .where(eq(userProfiles.userId, userId))
                .returning({
                    userId: userProfiles.userId,
                    fullName: userProfiles.fullName,
                    shippingAddress: userProfiles.shippingAddress,
                    updatedAt: userProfiles.updatedAt,
                });

            if (!updatedProfile) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "User profile not found",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                message: "User profile updated successfully",
                profile: updatedProfile,
            });
        }

        // -----------------------------
        // 4. VENDOR
        // -----------------------------

        if (role === "VENDOR") {
            const result = vendorProfileSchema.safeParse(body);

            if (!result.success) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Invalid vendor profile data",
                        errors: result.error.flatten().fieldErrors,
                    },
                    { status: 400 }
                );
            }

            const data = result.data;

            const updateData: Partial<
                typeof vendorProfiles.$inferInsert
            > = {
                updatedAt: new Date(),
            };

            if (data.companyName !== undefined) {
                updateData.companyName = data.companyName;
            }

            if (data.taxId !== undefined) {
                updateData.taxId = data.taxId;
            }

            if (data.businessAddress !== undefined) {
                updateData.businessAddress = data.businessAddress;
            }

            const [updatedProfile] = await db
                .update(vendorProfiles)
                .set(updateData)
                .where(eq(vendorProfiles.userId, userId))
                .returning({
                    userId: vendorProfiles.userId,
                    companyName: vendorProfiles.companyName,
                    taxId: vendorProfiles.taxId,
                    businessAddress: vendorProfiles.businessAddress,
                    updatedAt: vendorProfiles.updatedAt,
                });

            if (!updatedProfile) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Vendor profile not found",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json({
                success: true,
                message: "Vendor profile updated successfully",
                profile: updatedProfile,
            });
        }

        // -----------------------------
        // 5. Invalid role
        // -----------------------------

        return NextResponse.json(
            {
                success: false,
                message: "Invalid account role",
            },
            { status: 403 }
        );
    } catch (error) {
        console.error("PROFILE_UPDATE_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}