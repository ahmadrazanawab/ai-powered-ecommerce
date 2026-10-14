
import { cookies } from "next/headers";
import { jwtVerify } from "jose";

export async function getUserSession() {
    try {
        const token = (await cookies()).get("user_token")?.value;
        const secret = process.env.JWT_SECRET;

        if (!token || !secret) {
            return null;
        }

        const { payload } = await jwtVerify(
            token,
            new TextEncoder().encode(secret),
            { algorithms: ["HS256"] }
        );

        if (typeof payload.userId !== "string") {
            return null;
        }

        return {
            userId: payload.userId,
            email:
                typeof payload.email === "string"
                    ? payload.email
                    : undefined,
            mobileNumber:
                typeof payload.mobileNumber === "string"
                    ? payload.mobileNumber
                    : undefined,
        };
    } catch {
        return null;
    }
}
