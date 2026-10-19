import {
    pgTable,
    uuid,
    text,
    integer,
    numeric,
    timestamp,
    pgEnum,
    index,
    unique,
    check,
    jsonb,
    boolean
} from "drizzle-orm/pg-core";
import { orders } from "./checkout-schema";
export const refundStatusEnum = pgEnum("refund_status", [
  "pending",
  "processed",
  "failed",
]);

export const refundMethodEnum = pgEnum("refund_method", [
  "cash",
  "bank_transfer",
  "original_payment_method",
  "other",
]);

export const orderRefunds = pgTable(
  "order_refunds",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "restrict" }),

    amount: numeric("amount", {
      precision: 12,
      scale: 2,
    }).notNull(),

    method: refundMethodEnum("method").notNull(),

    status: refundStatusEnum("status").notNull().default("pending"),

    reason: text("reason"),

    processedBy: text("processed_by"),

    processedAt: timestamp("processed_at", {
      withTimezone: true,
      mode: "date",
    }),

    createdAt: timestamp("created_at", {
      withTimezone: true,
      mode: "date",
    })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("order_refunds_order_idx").on(t.orderId),
  ]
);