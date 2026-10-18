
import { NextRequest, NextResponse } from "next/server";
import { getUserSession } from "../auth/user/get-user-session";

export async function getAuthenticatedCustomer(
  _request: NextRequest
): Promise<
  | { success: true; customerId: string }
  | { success: false; response: NextResponse }
> {
  const session = await getUserSession();

  if (!session) {
    return {
      success: false,
      response: NextResponse.json(
        {
          success: false,
          message: "Unauthorized. Please log in.",
        },
        { status: 401 }
      ),
    };
  }

  return {
    success: true,
    customerId: session.userId,
  };
}
