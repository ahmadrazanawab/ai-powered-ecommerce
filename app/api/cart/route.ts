
import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import { cartSchema } from "@/app/api/lib/schema/cart-schema";
import { cartItemSchema } from "../lib/schema/cart-item-schema";
import { productSchema } from "@/app/api/lib/schema/product-schema";
import { categorySchema } from "@/app/api/lib/schema/category-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { getAuthenticatedCustomer } from "../lib/customer-cart-auth"; 

export async function GET(request: NextRequest) {
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
        data: { items: [], totalItems: 0, subtotal: "0.00" },
      });
    }

    const cartItems = await db
      .select({
        id: cartItemSchema.id,
        listingId: cartItemSchema.listingId,
        quantity: cartItemSchema.quantity,
      })
      .from(cartItemSchema)
      .where(eq(cartItemSchema.cartId, cart.id));

    let subtotal = 0;
    let totalItems = 0;

    const items = await Promise.all(
      cartItems.map(async (item) => {
        const [offer] = await db
          .select({
            productId: productSchema.id,
            name: productSchema.name,
            slug: productSchema.slug,
            imageUrl: productSchema.imageUrl,
            categoryName: categorySchema.name,
            vendorId: vendors.id,
            vendorName: vendors.name,
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
          .innerJoin(
            categorySchema,
            eq(productSchema.categoryId, categorySchema.id)
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
            cartItemId: item.id,
            listingId: item.listingId,
            quantity: item.quantity,
            available: false,
            message: "This offer is no longer available",
          };
        }

        const price = Number(offer.price);
        const lineTotal = price * item.quantity;
        const inStock = offer.stock >= item.quantity;

        subtotal += lineTotal;
        totalItems += item.quantity;

        return {
          cartItemId: item.id,
          listingId: item.listingId,
          productId: offer.productId,
          name: offer.name,
          slug: offer.slug,
          imageUrl: offer.imageUrl,
          categoryName: offer.categoryName,
          vendorId: offer.vendorId,
          vendorName: offer.vendorName,
          price: offer.price,
          stock: offer.stock,
          quantity: item.quantity,
          lineTotal: lineTotal.toFixed(2),
          available: inStock,
          ...(inStock ? {} : { message: "Insufficient stock for this quantity" }),
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        items,
        totalItems,
        subtotal: subtotal.toFixed(2),
      },
    });
  } catch (error) {
    console.error("GET_CART_ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Failed to fetch cart" },
      { status: 500 }
    );
  }
}
