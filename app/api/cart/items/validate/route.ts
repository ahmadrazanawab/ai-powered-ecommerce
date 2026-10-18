
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { cartSchema } from "@/app/api/lib/schema/cart-schema";
import { cartItemSchema } from "@/app/api/lib/schema/cart-item-schema";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { getAuthenticatedCustomer } from "@/app/api/lib/customer-cart-auth"; 

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthenticatedCustomer(request);
    if (!auth.success) return auth.response;

    const [cart] = await db
      .select({ id: cartSchema.id })
      .from(cartSchema)
      .where(eq(cartSchema.customerId, auth.customerId))
      .limit(1);

    if (!cart) {
      return NextResponse.json({
        success: true,
        valid: true,
        message: "Cart is empty",
        data: { items: [], subtotal: "0.00" },
      });
    }

    const items = await db
      .select({
        cartItemId: cartItemSchema.id,
        listingId: cartItemSchema.listingId,
        quantity: cartItemSchema.quantity,
      })
      .from(cartItemSchema)
      .where(eq(cartItemSchema.cartId, cart.id));

    const results = await Promise.all(
      items.map(async (item) => {
        const [offer] = await db
          .select({
            price: vendorProductSchema.price,
            stock: vendorProductSchema.stock,
            productName: productSchema.name,
            vendorName: vendors.name,
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
              eq(vendorProductSchema.id, item.listingId),
              eq(vendorProductSchema.isActive, true),
              eq(productSchema.isActive, true),
              eq(vendors.status, "approved"),
              eq(vendors.isActive, true)
            )
          )
          .limit(1);

        if (!offer) {
          return {
            cartItemId: item.cartItemId,
            listingId: item.listingId,
            quantity: item.quantity,
            valid: false,
            message: "Product offer is no longer available",
          };
        }

        const valid = offer.stock >= item.quantity;
        const lineTotal = Number(offer.price) * item.quantity;

        return {
          cartItemId: item.cartItemId,
          listingId: item.listingId,
          productName: offer.productName,
          vendorName: offer.vendorName,
          quantity: item.quantity,
          currentPrice: offer.price,
          stock: offer.stock,
          lineTotal: lineTotal.toFixed(2),
          valid,
          ...(valid ? {} : { message: "Insufficient stock" }),
        };
      })
    );

    const valid = results.every((item) => item.valid);

    const subtotal = results.reduce((total, item) => {
      if ("lineTotal" in item && item.valid) {
        return total + Number(item.lineTotal);
      }
      return total;
    }, 0);

    return NextResponse.json({
      success: true,
      valid,
      message: valid
        ? "Cart validated successfully"
        : "Some cart items need attention",
      data: {
        items: results,
        subtotal: subtotal.toFixed(2),
      },
    });
  } catch (error) {
    console.error("VALIDATE_CART_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to validate cart" },
      { status: 500 }
    );
  }
}
