// lib/auth/get-session.ts


import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export type UserSession = {
  userId: string;
  role: "USER";
  email?: string;
};

export async function getUserSession(): Promise<UserSession | null> {
  try {
    const token = (await cookies()).get("user_token")?.value;
    const jwtSecret = process.env.JWT_SECRET;

    if (!token || !jwtSecret || jwtSecret.length < 32) {
      return null;
    }

    const secretKey = new TextEncoder().encode(jwtSecret);

    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: ["HS256"],
    });

    if (
      typeof payload.userId !== "string" ||
      payload.role !== "USER" ||
      payload.sub !== payload.userId
    ) {
      return null;
    }

    return {
      userId: payload.userId,
      role: "USER",
      ...(typeof payload.email === "string"
        ? { email: payload.email }
        : {}),
    };
  } catch {
    // Missing, malformed, expired, or invalid JWT.
    return null;
  }
}
