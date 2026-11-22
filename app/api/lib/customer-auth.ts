import { NextResponse } from "next/server";
import { getUserSession } from "../auth/user/get-user-session";

type CustomerAuth =
  | { customerId: null; response: NextResponse }
  | { customerId: string; response: null };

export async function requireCustomer(): Promise<CustomerAuth> {
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