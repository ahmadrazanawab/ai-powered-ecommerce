
import { NextResponse, NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { SignJWT } from "jose";
import { vendorSignupSchema } from "@/app/api/lib/validations/vendor";
import { vendors } from "@/app/api/lib/schema/vendor";
import { db } from "@/app/api/lib/db";

export async function POST(req: NextRequest) {
    try {

        let body: unknown;

        try {
            body = await req.json();
        } catch (error) {
            return NextResponse.json({
                success: false,
                message: "Invalid JSON body"
            },
                { status: 400 }
            );
        }

        const result = vendorSignupSchema.safeParse(body);

        if (!result.success) {
            return NextResponse.json({
                success: false,
                error: "Invalid signup vendor data",
                errors: result.error.flatten().fieldErrors,
            },
                { status: 400 }
            )
        }

        const { name, email, mobileNumber, password } = result.data;

        // -----------------------------
        // 5. Check existing email
        // -----------------------------

        const [existingEmail] = await db
            .select({
                id: vendors.id
            })
            .from(vendors)
            .where(eq(vendors.email, email))
            .limit(1)

        if (existingEmail) {
            return NextResponse.json({
                success: false,
                error: "Vendor with this email already exists",
            }, { status: 409 })
        }


         // -----------------------------
        // 5. Check existing mobile number
        // -----------------------------

        if (mobileNumber) {
            const [existingPhone] = await db
                .select({
                    id: vendors.id
                })
                .from(vendors)
                .where(eq(vendors.mobileNumber, mobileNumber))
                .limit(1)

            if (existingPhone) {
                return NextResponse.json({
                    success: false,
                    error: "Vendor with this phone already exists",
                })
            }
        }

         // -----------------------------
        // 5. Hash password
        // -----------------------------

        const passwordHash = await bcrypt.hash(password, 12);
        
         // -----------------------------
        // 6. Create vendors
        // -----------------------------
        const [vendor] = await db
            .insert(vendors)
            .values({
                name,
                email,
                mobileNumber,
                passwordHash,

                status: "pending",
                isActive: false,
            })
            .returning({
                id: vendors.id,
                name: vendors.name,
                email: vendors.email,
                mobileNumber: vendors.mobileNumber,
                status: vendors.status,
                isActive: vendors.isActive,
                createdAt: vendors.createdAt
            });
        
        return NextResponse.json({
            success: true,
            message: "Vendor signup successful. Your account is waiting for approval.",
            vendor
        },
            { status: 201 }
        );


    } catch (error) {
        console.error("VENDOR_SIGNUP_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}