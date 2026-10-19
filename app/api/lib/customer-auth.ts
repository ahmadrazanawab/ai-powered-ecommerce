import { NextResponse } from "next/server";
import { getUserSession } from "../auth/user/get-user-session";

export async function requireCustomer() {
  const session = await getUserSession();

  if (!session) {
    return {
      customerId: null,
      response: NextResponse.json(
        { success: false, message: "Please log in." },
        { status: 401 }
      ),
    };
  }

  return {
    customerId: session.userId,
    response: null,
  };
}