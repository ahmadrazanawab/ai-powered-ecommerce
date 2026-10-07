// lib/auth/get-session.ts

export type UserRole = "USER" | "VENDOR";

export interface UserSession {
  userId: string;
  role: UserRole;
}

export async function getUserSession(): Promise<UserSession | null> {
  /*
   * MOCK ONLY
   *
   * In production:
   * 1. Read JWT from httpOnly cookie / Authorization header.
   * 2. Verify JWT signature.
   * 3. Decode payload.
   * 4. Return userId + role.
   */

  return {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "USER",
  };
}