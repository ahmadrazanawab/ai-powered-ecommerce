import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import Stripe from "stripe";

import { db } from "@/app/api/lib/db";
import { requireCustomer } from "@/app/api/lib/customer-auth";
import { cartSchema } from "@/app/api/lib/schema/cart-schema";
import { cartItemSchema } from "../lib/schema/cart-item-schema";
import {
  addresses,
  orders,
  orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
import { vendors } from "@/app/api/lib/schema/vendor";
import { productSchema } from "@/app/api/lib/schema/product-schema";

const RESERVATION_MINUTES = 20;

export async function POST(request: NextRequest) {
  let createdOrderId: string | null = null;

  try {
    const auth = await requireCustomer();

    if (!auth.customerId) {
      return auth.response;
    }

    const body = await request.json();

    if (typeof body.addressId !== "string" || !body.addressId) {
      return NextResponse.json(
        {
          success: false,
          message: "addressId is required",
        },
        { status: 400 }
      );
    }

    const paymentMethod = body.paymentMethod;

    if (paymentMethod !== "cod" && paymentMethod !== "stripe") {
      return NextResponse.json(
        {
          success: false,
          message: "Please select a valid payment method",
        },
        { status: 400 }
      );
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (paymentMethod === "stripe" && !stripeSecretKey) {
      return NextResponse.json(
        {
          success: false,
          code: "STRIPE_NOT_CONFIGURED",
          message:
            "Online payment is temporarily unavailable. Please choose Cash on Delivery.",
        },
        { status: 503 }
      );
    }

    const result = await db.transaction(async (tx) => {
      // Verify that the shipping address belongs to this customer.
      const [address] = await tx
        .select()
        .from(addresses)
        .where(
          and(
            eq(addresses.id, body.addressId),
            eq(addresses.userId, auth.customerId!)
          )
        )
        .limit(1);

      if (!address) {
        throw new Error("ADDRESS_NOT_FOUND");
      }

      // Find the customer's cart.
      const [cart] = await tx
        .select({
          id: cartSchema.id,
        })
        .from(cartSchema)
        .where(eq(cartSchema.customerId, auth.customerId!))
        .limit(1);

      if (!cart) {
        throw new Error("CART_EMPTY");
      }

      // Lock cart items during checkout.
      const items = await tx
        .select({
          cartItemId: cartItemSchema.id,
          listingId: cartItemSchema.listingId,
          quantity: cartItemSchema.quantity,
        })
        .from(cartItemSchema)
        .where(eq(cartItemSchema.cartId, cart.id))
        .for("update");

      if (!items.length) {
        throw new Error("CART_EMPTY");
      }

      const listingIds = items.map((item) => item.listingId);

      // Lock listings to prevent concurrent checkouts overselling stock.
      const offers = await tx
        .select({
          listingId: vendorProductSchema.id,
          productId: productSchema.id,
          productName: productSchema.name,
          price: vendorProductSchema.price,
          stock: vendorProductSchema.stock,
          vendorId: vendorProductSchema.vendorId,
        })
        .from(vendorProductSchema)
        .innerJoin(
          productSchema,
          eq(productSchema.id, vendorProductSchema.productId)
        )
        .innerJoin(
          vendors,
          eq(vendors.id, vendorProductSchema.vendorId)
        )
        .where(
          and(
            inArray(vendorProductSchema.id, listingIds),
            eq(vendorProductSchema.isActive, true),
            eq(productSchema.isActive, true),
            eq(vendors.status, "approved"),
            eq(vendors.isActive, true)
          )
        )
        .for("update", { of: vendorProductSchema });

      const offerMap = new Map(
        offers.map((offer) => [offer.listingId, offer])
      );

      let subtotalPaise = 0;

      const lines = items.map((item) => {
        const offer = offerMap.get(item.listingId);

        if (!offer) {
          throw new Error("OFFER_UNAVAILABLE");
        }

        if (offer.stock < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${offer.productName}`);
        }

        // Prices are stored as decimal strings; calculate in integer paise.
        const pricePaise = Math.round(Number(offer.price) * 100);

        if (!Number.isSafeInteger(pricePaise) || pricePaise <= 0) {
          throw new Error("INVALID_PRICE");
        }

        const lineTotalPaise = pricePaise * item.quantity;

        if (!Number.isSafeInteger(lineTotalPaise)) {
          throw new Error("INVALID_TOTAL");
        }

        subtotalPaise += lineTotalPaise;

        return {
          ...item,
          offer,
          pricePaise,
          lineTotalPaise,
        };
      });

      if (
        !Number.isSafeInteger(subtotalPaise) ||
        subtotalPaise < 1
      ) {
        throw new Error("INVALID_TOTAL");
      }

      // Decrement inventory atomically.
      for (const line of lines) {
        const updated = await tx
          .update(vendorProductSchema)
          .set({
            stock: sql`${vendorProductSchema.stock} - ${line.quantity}`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(vendorProductSchema.id, line.listingId),
              gt(vendorProductSchema.stock, line.quantity - 1),
              eq(vendorProductSchema.isActive, true)
            )
          )
          .returning({
            id: vendorProductSchema.id,
          });

        if (!updated.length) {
          throw new Error(
            `INSUFFICIENT_STOCK:${line.offer.productName}`
          );
        }
      }

      const shippingSnapshot = {
        fullName: address.fullName,
        phone: address.phone,
        addressLine1: address.addressLine1,
        addressLine2: address.addressLine2,
        city: address.city,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
      };

      // COD orders do not require an online-payment reservation timeout.
      const expiresAt =
        paymentMethod === "stripe"
          ? new Date(Date.now() + RESERVATION_MINUTES * 60 * 1000)
          : null;

      const [order] = await tx
        .insert(orders)
        .values({
          userId: auth.customerId!,
          addressId: address.id,
          shippingAddress: shippingSnapshot,
          subtotal: (subtotalPaise / 100).toFixed(2),
          currency: "inr",
          paymentMethod,
          status: paymentMethod === "cod" ? "confirmed" : "pending",
          paymentStatus: "pending",
          reservationExpiresAt: expiresAt,
        })
        .returning();

      await tx.insert(orderItems).values(
        lines.map((line) => ({
          orderId: order.id,
          vendorId: line.offer.vendorId,
          listingId: line.listingId,
          productId: line.offer.productId,
          productName: line.offer.productName,
          quantity: line.quantity,
          unitPrice: (line.pricePaise / 100).toFixed(2),
          lineTotal: (line.lineTotalPaise / 100).toFixed(2),
        }))
      );

      // Clear the cart only after the order and its items are saved.
      await tx
        .delete(cartItemSchema)
        .where(eq(cartItemSchema.cartId, cart.id));

      return {
        order,
        subtotalPaise,
      };
    });

    createdOrderId = result.order.id;

    // CASH ON DELIVERY
    if (paymentMethod === "cod") {
      return NextResponse.json(
        {
          success: true,
          message: "Order placed successfully with Cash on Delivery.",
          data: {
            orderId: result.order.id,
            paymentMethod: "cod",
            orderStatus: "confirmed",
            paymentStatus: "pending",
            amount: result.subtotalPaise,
            currency: "inr",
          },
        },
        { status: 201 }
      );
    }

    // STRIPE ONLINE PAYMENT
    const stripe = new Stripe(stripeSecretKey!);

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: result.subtotalPaise,
        currency: "inr",
        automatic_payment_methods: {
          enabled: true,
        },
        metadata: {
          orderId: result.order.id,
          customerId: auth.customerId,
        },
      },
      {
        idempotencyKey: `order-${result.order.id}`,
      }
    );

    await db
      .update(orders)
      .set({
        paymentIntentId: paymentIntent.id,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, result.order.id));

    return NextResponse.json(
      {
        success: true,
        message: "Order created. Complete your online payment.",
        data: {
          orderId: result.order.id,
          paymentMethod: "stripe",
          orderStatus: "pending",
          paymentStatus: "pending",
          amount: result.subtotalPaise,
          currency: "inr",
          paymentIntentId: paymentIntent.id,
          clientSecret: paymentIntent.client_secret,
          reservationExpiresAt: result.order.reservationExpiresAt,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("CHECKOUT_ERROR", error);

    // If Stripe setup fails after order creation, release reserved stock.
    if (createdOrderId) {
      await releaseOrderReservation(createdOrderId).catch((releaseError) =>
        console.error("RELEASE_RESERVATION_ERROR", releaseError)
      );
    }

    const message =
      error instanceof Error ? error.message : "";

    const status =
      message === "ADDRESS_NOT_FOUND"
        ? 404
        : message === "CART_EMPTY"
          ? 400
          : message === "OFFER_UNAVAILABLE" ||
              message.startsWith("INSUFFICIENT_STOCK:")
            ? 409
            : 500;

    const userMessage = message.startsWith("INSUFFICIENT_STOCK:")
      ? `Insufficient stock for ${message.split(":")[1]}`
      : ({
          ADDRESS_NOT_FOUND: "Shipping address not found",
          CART_EMPTY: "Your cart is empty",
          OFFER_UNAVAILABLE:
            "One or more offers are no longer available",
          INVALID_PRICE: "A product has an invalid price",
          INVALID_TOTAL: "The order total is invalid",
        } as Record<string, string>)[message] ||
        (status === 500 ? "Checkout failed" : message);

    return NextResponse.json(
      {
        success: false,
        message: userMessage,
      },
      { status }
    );
  }
}

// Restores reserved inventory once for an unpaid pending order.
async function releaseOrderReservation(orderId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");

    if (
      !order ||
      order.status !== "pending" ||
      order.paymentMethod !== "online" ||
      order.paymentStatus !== "pending"
    ) {
      return;
    }

    const items = await tx
      .select()
      .from(orderItems)
      .where(eq(orderItems.orderId, orderId));

    for (const item of items) {
      await tx
        .update(vendorProductSchema)
        .set({
          stock: sql`${vendorProductSchema.stock} + ${item.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(vendorProductSchema.id, item.listingId));
    }

    await tx
      .update(orders)
      .set({
        status: "cancelled",
        paymentStatus: "failed",
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));
  });
}







// import { NextRequest, NextResponse } from "next/server";
// import { and, eq, gt, inArray, sql } from "drizzle-orm";
// import Stripe from "stripe";

// import { db } from "@/app/api/lib/db";
// import { requireCustomer } from "@/app/api/lib/customer-auth";
// import { cartSchema } from "@/app/api/lib/schema/cart-schema";
// import { cartItemSchema } from "../lib/schema/cart-item-schema";
// import { addresses, orders, orderItems } from "@/app/api/lib/schema/checkout-schema";
// import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";
// import { vendors } from "@/app/api/lib/schema/vendor";
// import { productSchema } from "@/app/api/lib/schema/product-schema";

// const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
// const RESERVATION_MINUTES = 20;

// export async function POST(request: NextRequest) {
//     let createdOrderId: string | null = null;

//     try {
//         if (!process.env.STRIPE_SECRET_KEY) {
//             throw new Error("STRIPE_SECRET_KEY is not configured");
//         }

//         const auth = await requireCustomer();
//         if (!auth.customerId) return auth.response;

//         const body = await request.json();

//         if (typeof body.addressId !== "string") {
//             return NextResponse.json(
//                 { success: false, message: "addressId is required" },
//                 { status: 400 }
//             );
//         }

//         const result = await db.transaction(async (tx) => {
//             const [address] = await tx
//                 .select()
//                 .from(addresses)
//                 .where(
//                     and(
//                         eq(addresses.id, body.addressId),
//                         eq(addresses.userId, auth.customerId!)
//                     )
//                 )
//                 .limit(1);

//             if (!address) throw new Error("ADDRESS_NOT_FOUND");

//             const [cart] = await tx
//                 .select({ id: cartSchema.id })
//                 .from(cartSchema)
//                 .where(eq(cartSchema.customerId, auth.customerId!))
//                 .limit(1);

//             if (!cart) throw new Error("CART_EMPTY");

//             // Lock cart rows while checkout processes them.
//             const items = await tx
//                 .select({
//                     cartItemId: cartItemSchema.id,
//                     listingId: cartItemSchema.listingId,
//                     quantity: cartItemSchema.quantity,
//                 })
//                 .from(cartItemSchema)
//                 .where(eq(cartItemSchema.cartId, cart.id))
//                 .for("update");

//             if (!items.length) throw new Error("CART_EMPTY");

//             const listingIds = items.map((item) => item.listingId);

//             // Lock vendor listings so two checkouts cannot consume the same stock.
//             const offers = await tx
//                 .select({
//                     listingId: vendorProductSchema.id,
//                     productId: productSchema.id,
//                     productName: productSchema.name,
//                     price: vendorProductSchema.price,
//                     stock: vendorProductSchema.stock,
//                     vendorId: vendorProductSchema.vendorId,
//                 })
//                 .from(vendorProductSchema)
//                 .innerJoin(
//                     productSchema,
//                     eq(productSchema.id, vendorProductSchema.productId)
//                 )
//                 .innerJoin(
//                     vendors,
//                     eq(vendors.id, vendorProductSchema.vendorId)
//                 )
//                 .where(
//                     and(
//                         inArray(vendorProductSchema.id, listingIds),
//                         eq(vendorProductSchema.isActive, true),
//                         eq(productSchema.isActive, true),
//                         eq(vendors.status, "approved"),
//                         eq(vendors.isActive, true)
//                     )
//                 )
//                 .for("update", { of: vendorProductSchema });

//             const offerMap = new Map(offers.map((offer) => [offer.listingId, offer]));

//             let subtotalPaise = 0;

//             const lines = items.map((item) => {
//                 const offer = offerMap.get(item.listingId);

//                 if (!offer) throw new Error("OFFER_UNAVAILABLE");
//                 if (offer.stock < item.quantity) {
//                     throw new Error(`INSUFFICIENT_STOCK:${offer.productName}`);
//                 }

//                 // Prices are decimal strings, so convert to paise for integer math.
//                 const pricePaise = Math.round(Number(offer.price) * 100);
//                 if (!Number.isSafeInteger(pricePaise) || pricePaise <= 0) {
//                     throw new Error("INVALID_PRICE");
//                 }

//                 const lineTotalPaise = pricePaise * item.quantity;
//                 subtotalPaise += lineTotalPaise;

//                 return {
//                     ...item,
//                     offer,
//                     pricePaise,
//                     lineTotalPaise,
//                 };
//             });

//             if (!Number.isSafeInteger(subtotalPaise) || subtotalPaise < 1) {
//                 throw new Error("INVALID_TOTAL");
//             }

//             // Atomically decrement stock. The stock predicate prevents overselling.
//             for (const line of lines) {
//                 const updated = await tx
//                     .update(vendorProductSchema)
//                     .set({
//                         stock: sql`${vendorProductSchema.stock} - ${line.quantity}`,
//                         updatedAt: new Date(),
//                     })
//                     .where(
//                         and(
//                             eq(vendorProductSchema.id, line.listingId),
//                             gt(vendorProductSchema.stock, line.quantity - 1),
//                             eq(vendorProductSchema.isActive, true)
//                         )
//                     )
//                     .returning({ id: vendorProductSchema.id });

//                 if (!updated.length) {
//                     throw new Error(`INSUFFICIENT_STOCK:${line.offer.productName}`);
//                 }
//             }

//             const shippingSnapshot = {
//                 fullName: address.fullName,
//                 phone: address.phone,
//                 addressLine1: address.addressLine1,
//                 addressLine2: address.addressLine2,
//                 city: address.city,
//                 state: address.state,
//                 postalCode: address.postalCode,
//                 country: address.country,
//             };
            
//             const expiresAt = new Date(
//                 Date.now() + RESERVATION_MINUTES * 60 * 1000
//             );

//             const [order] = await tx
//                 .insert(orders)
//                 .values({
//                     userId: auth.customerId!,
//                     addressId: address.id,
//                     shippingAddress: shippingSnapshot,
//                     subtotal: (subtotalPaise / 100).toFixed(2),
//                     currency: "inr",
//                     status: "pending",
//                     paymentStatus: "pending",
//                     reservationExpiresAt: expiresAt,
//                 })
//                 .returning();

//             await tx.insert(orderItems).values(
//                 lines.map((line) => ({
//                     orderId: order.id,
//                     vendorId: line.offer.vendorId,
//                     listingId: line.listingId,
//                     productId: line.offer.productId,
//                     productName: line.offer.productName,
//                     quantity: line.quantity,
//                     unitPrice: (line.pricePaise / 100).toFixed(2),
//                     lineTotal: (line.lineTotalPaise / 100).toFixed(2),
//                 }))
//             );

//             // Clear only after order rows are persisted.
//             await tx
//                 .delete(cartItemSchema)
//                 .where(eq(cartItemSchema.cartId, cart.id));

//             return { order, subtotalPaise };
//         });

//         createdOrderId = result.order.id;

//         const paymentIntent = await stripe.paymentIntents.create({
//             amount: result.subtotalPaise,
//             currency: "inr",
//             automatic_payment_methods: { enabled: true },
//             metadata: {
//                 orderId: result.order.id,
//                 customerId: auth.customerId,
//             },
//         }, {
//             idempotencyKey: `order-${result.order.id}`,
//         });

//         await db
//             .update(orders)
//             .set({
//                 paymentIntentId: paymentIntent.id,
//                 updatedAt: new Date(),
//             })
//             .where(eq(orders.id, result.order.id));

//         return NextResponse.json({
//             success: true,
//             message: "Order created. Complete payment to confirm it.",
//             data: {
//                 orderId: result.order.id,
//                 amount: result.subtotalPaise,
//                 currency: "inr",
//                 paymentIntentId: paymentIntent.id,
//                 clientSecret: paymentIntent.client_secret,
//                 reservationExpiresAt: result.order.reservationExpiresAt,
//             },
//         }, { status: 201 });
//     } catch (error) {
//         console.error("CHECKOUT_ERROR", error);

//         // If Stripe setup failed after the transaction, release the reservation.
//         if (createdOrderId) {
//             await releaseOrderReservation(createdOrderId).catch((e) =>
//                 console.error("RELEASE_RESERVATION_ERROR", e)
//             );
//         }

//         const message = error instanceof Error ? error.message : "";

//         const status =
//             message === "ADDRESS_NOT_FOUND" ? 404 :
//                 message === "CART_EMPTY" ? 400 :
//                     message === "OFFER_UNAVAILABLE" ||
//                         message.startsWith("INSUFFICIENT_STOCK:") ? 409 :
//                         500;

//         return NextResponse.json({
//             success: false,
//             message:
//                 message.startsWith("INSUFFICIENT_STOCK:")
//                     ? `Insufficient stock for ${message.split(":")[1]}`
//                     : ({
//                         ADDRESS_NOT_FOUND: "Shipping address not found",
//                         CART_EMPTY: "Your cart is empty",
//                         OFFER_UNAVAILABLE: "One or more offers are no longer available",
//                     } as Record<string, string>)[message] ||
//                     (status === 500 ? "Checkout failed" : message),
//         }, { status });
//     }
// }

// // Restores reserved inventory exactly once, inside one transaction.
// async function releaseOrderReservation(orderId: string) {
//     await db.transaction(async (tx) => {
//         const [order] = await tx
//             .select()
//             .from(orders)
//             .where(eq(orders.id, orderId))
//             .for("update");

//         if (!order || order.status !== "pending") return;

//         const items = await tx
//             .select()
//             .from(orderItems)
//             .where(eq(orderItems.orderId, orderId));

//         for (const item of items) {
//             await tx
//                 .update(vendorProductSchema)
//                 .set({
//                     stock: sql`${vendorProductSchema.stock} + ${item.quantity}`,
//                     updatedAt: new Date(),
//                 })
//                 .where(eq(vendorProductSchema.id, item.listingId));
//         }

//         await tx
//             .update(orders)
//             .set({
//                 status: "cancelled",
//                 paymentStatus: "failed",
//                 updatedAt: new Date(),
//             })
//             .where(eq(orders.id, orderId));
//     });
// }
