
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { cartSchema } from "@/app/api/lib/schema/cart-schema";
import { cartItemSchema } from "@/app/api/lib/schema/cart-item-schema";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { getAuthenticatedCustomer } from "@/app/api/lib/customer-cart-auth"; 

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthenticatedCustomer(request);
    if (!auth.success) return auth.response;

    const { itemId } = await params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (
      !body ||
      typeof body !== "object" ||
      !("quantity" in body) ||
      !Number.isSafeInteger(body.quantity) ||
      (body.quantity as number) < 1
    ) {
      return NextResponse.json(
        { success: false, message: "Quantity must be a positive integer" },
        { status: 400 }
      );
    }

    const quantity = body.quantity as number;

    const [item] = await db
      .select({
        id: cartItemSchema.id,
        listingId: cartItemSchema.listingId,
      })
      .from(cartItemSchema)
      .innerJoin(cartSchema, eq(cartItemSchema.cartId, cartSchema.id))
      .where(
        and(
          eq(cartItemSchema.id, itemId),
          eq(cartSchema.customerId, auth.customerId)
        )
      )
      .limit(1);

    if (!item) {
      return NextResponse.json(
        { success: false, message: "Cart item not found" },
        { status: 404 }
      );
    }

    const [offer] = await db
      .select({
        stock: vendorProductSchema.stock,
      })
      .from(vendorProductSchema)
      .innerJoin(
        productSchema,
        eq(vendorProductSchema.productId, productSchema.id)
      )
      .innerJoin(vendors, eq(vendorProductSchema.vendorId, vendors.id))
      .where(
        and(
          eq(vendorProductSchema.id, item.listingId),
          eq(vendorProductSchema.isActive, true),
          eq(productSchema.isActive, true),
          eq(vendors.status, "approved"),
          eq(vendors.isActive, true)
        )
      )
      .limit(1);

    if (!offer) {
      return NextResponse.json(
        { success: false, message: "This vendor offer is no longer available" },
        { status: 409 }
      );
    }

    if (quantity > offer.stock) {
      return NextResponse.json(
        {
          success: false,
          message: `Only ${offer.stock} item(s) are currently in stock`,
        },
        { status: 409 }
      );
    }

    const [updatedItem] = await db
      .update(cartItemSchema)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(cartItemSchema.id, item.id))
      .returning();

    return NextResponse.json({
      success: true,
      message: "Cart quantity updated successfully",
      data: updatedItem,
    });
  } catch (error) {
    console.error("UPDATE_CART_ITEM_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to update cart item" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const auth = await getAuthenticatedCustomer(request);
    if (!auth.success) return auth.response;

    const { itemId } = await params;

    const [deletedItem] = await db
      .delete(cartItemSchema)
      .where(
        and(
          eq(cartItemSchema.id, itemId),
          eq(
            cartItemSchema.cartId,
            db
              .select({ id: cartSchema.id })
              .from(cartSchema)
              .where(eq(cartSchema.customerId, auth.customerId))
          )
        )
      )
      .returning({ id: cartItemSchema.id });

    if (!deletedItem) {
      return NextResponse.json(
        { success: false, message: "Cart item not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Item removed from cart successfully",
    });
  } catch (error) {
    console.error("DELETE_CART_ITEM_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to remove cart item" },
      { status: 500 }
    );
  }
}
