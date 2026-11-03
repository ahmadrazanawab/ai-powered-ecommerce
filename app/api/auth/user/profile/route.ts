
import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { requireUser } from "../require-user";

// ======================================
// GET USER PROFILE
// ======================================
export async function GET(request: NextRequest) {
    try {
        // 1. Authenticate customer
        const auth = await requireUser(request);

        if (!auth.ok) {
            return auth.response;
        }

        // 2. Get authenticated user ID
        const userId = auth.user.id;

        // 3. Fetch profile
        const [user] = await db
            .select({
                id: users.id,
                name: users.name,
                email: users.email,
                mobileNo: users.mobileNo,
                isActive: users.isVerified
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User profile not found",
                },
                { status: 404 }
            );
        }

        // 4. Return profile
        return NextResponse.json(
            {
                success: true,
                message: "User profile fetched successfully",
                user,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("USER_PROFILE_GET_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}

// ======================================
// UPDATE USER PROFILE
// ======================================
export async function PUT(request: NextRequest) {
    try {
        // 1. Authenticate customer
        const auth = await requireUser(request);

        if (!auth.ok) {
            return auth.response;
        }

        // 2. Get authenticated user ID
        const userId = auth.user.id;

        // 3. Parse request body
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

        // 4. Validate basic input
        if (
            typeof body !== "object" ||
            body === null ||
            Array.isArray(body)
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid request data",
                },
                { status: 400 }
            );
        }

        const data = body as Record<string, unknown>;

        const allowedFields = ["name", "email", "mobileNo"];

        const hasInvalidField = Object.keys(data).some(
            (key) => !allowedFields.includes(key)
        );

        if (hasInvalidField) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Invalid profile fields",
                },
                { status: 400 }
            );
        }

        const updateData: {
            name?: string;
            email?: string;
            mobileNo?: string;
        } = {};

        if (Object.hasOwn(data, "name")) {
            if (typeof data.name !== "string" || !data.name.trim()) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Valid name is required",
                    },
                    { status: 400 }
                );
            }

            updateData.name = data.name.trim();
        }

        if (Object.hasOwn(data, "email")) {
            if (
                typeof data.email !== "string" ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Valid email is required",
                    },
                    { status: 400 }
                );
            }

            updateData.email = data.email.trim().toLowerCase();
        }

        if (Object.hasOwn(data, "mobileNo")) {
            if (
                typeof data.mobileNo !== "string" ||
                !/^\+?[0-9]{10,15}$/.test(data.mobileNo.trim())
            ) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Valid mobile number is required",
                    },
                    { status: 400 }
                );
            }

            updateData.mobileNo = data.mobileNo.trim();
        }

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json(
                {
                    success: false,
                    message: "No profile fields provided",
                },
                { status: 400 }
            );
        }

        // 5. Update profile
        const [updatedUser] = await db
            .update(users)
            .set(updateData)
            .where(eq(users.id, userId))
            .returning({
                id: users.id,
                name: users.name,
                email: users.email,
                mobileNo: users.mobileNo,
            });

        if (!updatedUser) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User profile not found",
                },
                { status: 404 }
            );
        }

        // 6. Return updated profile
        return NextResponse.json(
            {
                success: true,
                message: "User profile updated successfully",
                user: updatedUser,
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("USER_PROFILE_PUT_ERROR:", error);

        return NextResponse.json(
            {
                success: false,
                message: "Internal server error",
            },
            { status: 500 }
        );
    }
}









// import { NextRequest, NextResponse } from "next/server";
// import { createHash, randomInt } from "crypto";
// import { eq } from "drizzle-orm";
// import { SignJWT } from "jose";

// import { db } from "@/app/api/lib/db";
// import { users } from "@/app/api/lib/schema/users";
// import { otpCodes } from "@/app/api/lib/schema/user_otp";
// import { userOtpRequestSchema } from "@/app/api/lib/validations/user";
// import { requireUser } from "../require-user";
// export async function POST(request: NextRequest) {
//     try {
//         // 1. Parse request body
//         let body: unknown;

//         try {
//             body = await request.json();
//         } catch {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Invalid JSON body",
//                 },
//                 { status: 400 }
//             );
//         }

//         // 2. Validate input using Zod
//         const result = userOtpRequestSchema.safeParse(body);

//         if (!result.success) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Invalid request data",
//                     errors: result.error.flatten().fieldErrors,
//                 },
//                 { status: 400 }
//             );
//         }

//         const { identifier, purpose } = result.data;

//         // 3. Check whether the customer exists
//         const isEmail = identifier.includes("@");

//         const [existingUser] = await db
//             .select({
//                 id: users.id,
//                 email: users.email,
//                 mobileNumber: users.mobileNo,
//             })
//             .from(users)
//             .where(
//                 isEmail
//                     ? eq(users.email, identifier)
//                     : eq(users.mobileNo, identifier)
//             )
//             .limit(1);

//         if (purpose === "signup" && existingUser) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message:
//                         "An account already exists. Please log in.",
//                 },
//                 { status: 409 }
//             );
//         }

//         if (purpose === "login" && !existingUser) {
//             return NextResponse.json(
//                 {
//                     success: false,
//                     message:
//                         "No account found. Please sign up first.",
//                 },
//                 { status: 404 }
//             );
//         }

//         // 4. Generate a cryptographically secure 6-digit OTP
//         const otp = randomInt(0, 1_000_000)
//             .toString()
//             .padStart(6, "0");

//         // 5. Hash the OTP before saving it
//         const otpSecret = process.env.OTP_HASH_SECRET;

//         if (!otpSecret) {
//             console.error("OTP_HASH_SECRET is not configured");

//             return NextResponse.json(
//                 {
//                     success: false,
//                     message: "Server configuration error",
//                 },
//                 { status: 500 }
//             );
//         }

//         const codeHash = createHash("sha256")
//             .update(`${otpSecret}:${identifier}:${purpose}:${otp}`)
//             .digest("hex");

//         // 6. Set OTP expiry (5 minutes)
//         const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

//         // 7. Save OTP hash in PostgreSQL
//         await db.insert(otpCodes).values({
//             identifier,
//             codeHash,
//             purpose,
//             expiresAt,
//         });



//         // 8. Development only: print OTP to server terminal
//         if (process.env.NODE_ENV !== "production") {
//             console.log(
//                 `[CUSTOMER OTP - DEVELOPMENT] ${identifier}: ${otp}`
//             );
//         }

//         // -----------------------------
//         // 9. Vendor jwt
//         // -----------------------------
//         const secret = process.env.JWT_SECRET;

//         if (!secret) {
//             throw new Error("JWT_SECRET is not configured");
//         }
//         console.log({
//             userId: users.id,
//             email: users.email,
//             mobileNo: users.mobileNo,
//             types: {
//                 userId: typeof users.id,
//                 email: typeof users.email,
//                 mobileNo: typeof users.mobileNo,
//             },
//         });
//         const token = await new SignJWT({
//             userId: users.id,
//             email: users.email,
//             mobileNumber: users.mobileNo
//         })
//             .setProtectedHeader({ alg: "HS256" })
//             .setIssuedAt()
//             .setExpirationTime("1d")
//             .sign(new TextEncoder().encode(secret));


//         // TODO: Send OTP by email or SMS when delivery is integrated.

//         const response = NextResponse.json(
//             {
//                 success: true,
//                 message: "OTP generated successfully. Check server terminal during development.",
//                 expiresIn: 300,
//             },
//             { status: 200 }
//         );

//         response.cookies.set("user_token", token, {
//             httpOnly: true,
//             secure: process.env.NODE_ENV === "production",
//             sameSite: "lax",
//             maxAge: 60 * 60 * 24, // 1 day
//             path: "/",
//         });

//         return response;
//     } catch (error) {
//         console.error("CUSTOMER_REQUEST_OTP_ERROR:", error);

//         return NextResponse.json(
//             {
//                 success: false,
//                 message: "Internal server error",
//             },
//             { status: 500 }
//         );
//     }
// }
