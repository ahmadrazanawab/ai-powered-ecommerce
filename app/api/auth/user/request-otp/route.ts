
import { NextRequest, NextResponse } from "next/server";
import { createHash, randomInt } from "node:crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { users } from "@/app/api/lib/schema/users";
import { otpCodes } from "@/app/api/lib/schema/user_otp";
import { userOtpRequestSchema } from "@/app/api/lib/validations/user";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    const validation = userOtpRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid request data",
          errors: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { identifier, purpose } = validation.data;
    const isEmail = identifier.includes("@");

    const otpSecret = process.env.OTP_HASH_SECRET;

    if (!otpSecret || otpSecret.length < 32) {
      console.error(
        "OTP_HASH_SECRET is missing or too short"
      );

      return NextResponse.json(
        { success: false, message: "Server configuration error" },
        { status: 500 }
      );
    }

    const [existingUser] = await db
      .select({ id: users.id })
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
          message: "An account already exists. Please log in.",
        },
        { status: 409 }
      );
    }

    if (purpose === "login" && !existingUser) {
      return NextResponse.json(
        {
          success: false,
          message: "No account found. Please sign up first.",
        },
        { status: 404 }
      );
    }

    const otp = randomInt(0, 1_000_000)
      .toString()
      .padStart(6, "0");

    const codeHash = createHash("sha256")
      .update(
        `${otpSecret}:${identifier}:${purpose}:${otp}`
      )
      .digest("hex");

    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Invalidate previous unused OTPs for this purpose.
    await db
      .update(otpCodes)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(otpCodes.identifier, identifier),
          eq(otpCodes.purpose, purpose),
          isNull(otpCodes.usedAt)
        )
      );

    await db.insert(otpCodes).values({
      identifier,
      codeHash,
      purpose,
      expiresAt,
    });

    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[CUSTOMER OTP - DEVELOPMENT] ${identifier}: ${otp}`
      );
    }

    // TODO: send the OTP using your email/SMS provider.
    return NextResponse.json(
      {
        success: true,
        message:
          "OTP generated. Check the server terminal during development.",
        expiresIn: 300,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("CUSTOMER_REQUEST_OTP_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}