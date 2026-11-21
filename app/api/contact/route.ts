// file : app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq, gte, or, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { requireCustomer } from "@/app/api/lib/customer-auth";
import { contactMessages } from "@/app/api/lib/schema/contact-schema";
import { contactSchema } from "../lib/validations/contact";

// Max messages per person (same account, email or IP) in the window.
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

/** Logged in → the customer id. Guest (or bad/expired token) → null. */
async function getOptionalCustomerId(): Promise<string | null> {
  try {
    const auth = await requireCustomer();
    return auth.customerId ?? null;
  } catch {
    return null;
  }
}

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get("x-forwarded-for");
  return (
    forwarded?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    null
  );
}

/* ---------- POST: send a message (guest OR logged in) ---------- */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null);

    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      // { fieldName: "first error for that field" }
      const errors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const field = String(issue.path[0] ?? "form");
        if (!errors[field]) errors[field] = issue.message;
      }

      return NextResponse.json(
        {
          success: false,
          message: Object.values(errors)[0] ?? "Invalid request",
          errors,
        },
        { status: 400 }
      );
    }

    const data = parsed.data;

    // Optional login: guests are welcome, logged-in customers get linked.
    const customerId = await getOptionalCustomerId();
    const ip = clientIp(request);

    // Simple abuse protection: same account, email or IP.
    const identity = [eq(contactMessages.email, data.email)];
    if (ip) identity.push(eq(contactMessages.ipAddress, ip));
    if (customerId) identity.push(eq(contactMessages.userId, customerId));

    const [recent] = await db
      .select({ total: sql<number>`count(*)::int` })
      .from(contactMessages)
      .where(
        and(
          gte(
            contactMessages.createdAt,
            new Date(Date.now() - RATE_WINDOW_MS)
          ),
          or(...identity)
        )
      );

    if ((recent?.total ?? 0) >= RATE_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          message:
            "You've sent several messages recently. Please wait a while before sending another.",
        },
        { status: 429 }
      );
    }

    const [created] = await db
      .insert(contactMessages)
      .values({
        userId: customerId,
        fullName: data.fullName,
        email: data.email,
        phone: data.phone ?? null,
        subject: data.subject,
        orderRef: data.orderId ?? null,
        message: data.message,
        ipAddress: ip,
      })
      .returning({ id: contactMessages.id });

    return NextResponse.json(
      {
        success: true,
        message: "Thanks! Your message has been sent.",
        data: { id: created.id },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CONTACT_POST_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Failed to send your message" },
      { status: 500 }
    );
  }
}

/* ---------- GET: the logged-in customer's own messages ---------- */
export async function GET() {
  try {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response;

    const data = await db
      .select({
        id: contactMessages.id,
        subject: contactMessages.subject,
        orderRef: contactMessages.orderRef,
        message: contactMessages.message,
        status: contactMessages.status,
        createdAt: contactMessages.createdAt,
      })
      .from(contactMessages)
      .where(eq(contactMessages.userId, auth.customerId))
      .orderBy(desc(contactMessages.createdAt))
      .limit(50);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("CONTACT_GET_ERROR", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch your messages" },
      { status: 500 }
    );
  }
}