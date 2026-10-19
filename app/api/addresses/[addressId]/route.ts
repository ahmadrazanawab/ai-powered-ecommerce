import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/app/api/lib/db";
import { addresses } from "@/app/api/lib/schema/checkout-schema";
import { requireCustomer } from "@/app/api/lib/customer-auth";

type Context = { params: Promise<{ addressId: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  try {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response;

    const { addressId } = await params;
    const body = await request.json();

    const allowed = [
      "fullName", "phone", "addressLine1", "addressLine2",
      "city", "state", "postalCode", "country",
    ] as const;

    const update: Record<string, string | null> = {};

    for (const key of allowed) {
      if (key in body) {
        if (key === "addressLine2" && body[key] === "") {
          update[key] = null;
        } else if (
          typeof body[key] === "string" &&
          body[key].trim()
        ) {
          update[key] = body[key].trim();
        } else {
          return NextResponse.json(
            { success: false, message: `Invalid ${key}` },
            { status: 400 }
          );
        }
      }
    }

    if (!Object.keys(update).length) {
      return NextResponse.json(
        { success: false, message: "No fields to update" },
        { status: 400 }
      );
    }

    const [data] = await db
      .update(addresses)
      .set({ ...update, updatedAt: new Date() })
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, auth.customerId)
        )
      )
      .returning();

    if (!data) {
      return NextResponse.json(
        { success: false, message: "Address not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("UPDATE_ADDRESS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to update address" },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  try {
    const auth = await requireCustomer();
    if (!auth.customerId) return auth.response;

    const { addressId } = await params;

    const [deleted] = await db
      .delete(addresses)
      .where(
        and(
          eq(addresses.id, addressId),
          eq(addresses.userId, auth.customerId)
        )
      )
      .returning({ id: addresses.id });

    if (!deleted) {
      return NextResponse.json(
        { success: false, message: "Address not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, message: "Address deleted" });
  } catch (error) {
    console.error("DELETE_ADDRESS_ERROR", error);
    return NextResponse.json(
      { success: false, message: "Failed to delete address" },
      { status: 500 }
    );
  }
}