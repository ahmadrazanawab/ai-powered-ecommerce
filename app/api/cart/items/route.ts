
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { cartSchema } from "@/app/api/lib/schema/cart-schema";
import { cartItemSchema } from "@/app/api/lib/schema/cart-item-schema";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { getAuthenticatedCustomer } from "@/app/api/lib/customer-cart-auth";

const isUuid = (value: unknown): value is string =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedCustomer(request);
    if (!auth.success) return auth.response;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { success: false, message: "Invalid JSON body" },
        { status: 400 }
      );
    }

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, message: "Invalid request body" },
        { status: 400 }
      );
    }

    const { listingId, quantity } = body as {
      listingId?: unknown;
      quantity?: unknown;
    };

    if (
      !isUuid(listingId) ||
      !Number.isSafeInteger(quantity) ||
      (quantity as number) < 1
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid listingId and positive integer quantity are required",
        },
        { status: 400 }
      );
    }

    const requestedQuantity = quantity as number;

    const result = await db.transaction(async (tx) => {
      const [offer] = await tx
        .select({
          listingId: vendorProductSchema.id,
          price: vendorProductSchema.price,
          stock: vendorProductSchema.stock,
        })
        .from(vendorProductSchema)
        .innerJoin(
          productSchema,
          eq(vendorProductSchema.productId, productSchema.id)
        )
        .innerJoin(
          vendors,
          eq(vendorProductSchema.vendorId, vendors.id)
        )
        .where(
          and(
            eq(vendorProductSchema.id, listingId),
            eq(vendorProductSchema.isActive, true),
            eq(productSchema.isActive, true),
            eq(vendors.status, "approved"),
            eq(vendors.isActive, true)
          )
        )
        .limit(1);

      if (!offer) {
        return {
          error: "This vendor offer is unavailable",
          status: 404,
        };
      }

      const [cart] = await tx
        .select({ id: cartSchema.id })
        .from(cartSchema)
        .where(eq(cartSchema.customerId, auth.customerId))
        .limit(1);

      let cartId = cart?.id;

      if (!cartId) {
        const [newCart] = await tx
          .insert(cartSchema)
          .values({ customerId: auth.customerId })
          .returning({ id: cartSchema.id });

        cartId = newCart.id;
      }

      const [existingItem] = await tx
        .select({
          id: cartItemSchema.id,
          quantity: cartItemSchema.quantity,
        })
        .from(cartItemSchema)
        .where(
          and(
            eq(cartItemSchema.cartId, cartId),
            eq(cartItemSchema.listingId, listingId)
          )
        )
        .limit(1);

      const finalQuantity =
        (existingItem?.quantity ?? 0) + requestedQuantity;

      if (finalQuantity > offer.stock) {
        return {
          error: `Only ${offer.stock} item(s) are currently in stock`,
          status: 409,
        };
      }

      if (existingItem) {
        await tx
          .update(cartItemSchema)
          .set({
            quantity: finalQuantity,
            updatedAt: new Date(),
          })
          .where(eq(cartItemSchema.id, existingItem.id));
      } else {
        await tx.insert(cartItemSchema).values({
          cartId,
          listingId,
          quantity: requestedQuantity,
        });
      }

      return {
        cartId,
        listingId,
        quantity: finalQuantity,
        currentPrice: offer.price,
      };
    });

    if ("error" in result) {
      return NextResponse.json(
        { success: false, message: result.error },
        { status: result.status }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Item added to cart successfully",
        data: result,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("ADD_CART_ITEM_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to add item to cart" },
      { status: 500 }
    );
  }
}
