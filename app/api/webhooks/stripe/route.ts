
import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/app/api/lib/db";
import {
  orders,
  orderItems,
} from "@/app/api/lib/schema/checkout-schema";
import { vendorProductSchema } from "@/app/api/lib/schema/vendor-product-schema";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !secret) {
    return NextResponse.json({ message: "Webhook configuration missing" }, {
      status: 400,
    });
  }

  let event: Stripe.Event;

  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, secret);
  } catch (error) {
    console.error("STRIPE_SIGNATURE_ERROR", error);
    return NextResponse.json({ message: "Invalid signature" }, {
      status: 400,
    });
  }

  try {
    if (event.type === "payment_intent.succeeded") {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata.orderId;

      if (orderId) {
        await db.transaction(async (tx) => {
          const [order] = await tx
            .select()
            .from(orders)
            .where(eq(orders.id, orderId))
            .for("update");

          if (!order) throw new Error("ORDER_NOT_FOUND");

          // Idempotent: Stripe can deliver an event more than once.
          if (order.paymentStatus === "succeeded") return;

          if (order.paymentIntentId !== intent.id) {
            throw new Error("PAYMENT_INTENT_MISMATCH");
          }

          // A late success after stock was released needs manual recovery.
          if (order.status !== "pending_payment") {
            throw new Error("ORDER_NOT_PENDING_PAYMENT");
          }

          if (order.reservationExpiresAt <= new Date()) {
            throw new Error("RESERVATION_EXPIRED");
          }

          const expectedAmount = Math.round(Number(order.subtotal) * 100);

          if (
            intent.currency !== order.currency ||
            intent.amount_received !== expectedAmount
          ) {
            throw new Error("PAYMENT_AMOUNT_MISMATCH");
          }

          await tx
            .update(orders)
            .set({
              status: "paid",
              paymentStatus: "succeeded",
              updatedAt: new Date(),
            })
            .where(eq(orders.id, orderId));
        });
      }
    }

    if (
      event.type === "payment_intent.payment_failed" ||
      event.type === "payment_intent.canceled"
    ) {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata.orderId;

      if (orderId) {
        await releaseReservation(orderId, intent.id);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("STRIPE_WEBHOOK_PROCESSING_ERROR", error);

    // A non-2xx response lets Stripe retry transient failures.
    return NextResponse.json({ message: "Webhook processing failed" }, {
      status: 500,
    });
  }
}

async function releaseReservation(orderId: string, paymentIntentId: string) {
  await db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, orderId))
      .for("update");

    if (!order) return;

    if (
      order.paymentIntentId !== paymentIntentId ||
      order.status !== "pending_payment" ||
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
        status: "payment_failed",
        paymentStatus: "failed",
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(orders.id, orderId),
          eq(orders.status, "pending_payment")
        )
      );
  });
}
