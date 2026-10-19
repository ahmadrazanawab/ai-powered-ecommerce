
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
    jsonb
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users";
import { vendors } from "./vendor";
import { vendorProductSchema } from "./vendor-product-schema";


export const paymentMethodEnum = pgEnum("payment_method", [
    "cod",
    "online",
]);

export const orderStatusEnum = pgEnum("order_status", [
    "pending",
    "confirmed",
    "processing",
    "shipped",
    "delivered",
    "cancelled",
]);

export const paymentStatusEnum = pgEnum("payment_status", [
    "pending",
    "processing",
    "paid",
    "succeeded",
    "failed",
    "refunded",
    "cancelled"
]);
export const vendorFulfillmentStatusEnum = pgEnum(
    "vendor_fulfillment_status",
    ["pending", "processing", "shipped", "delivered", "cancelled"]
);


export const addresses = pgTable(
    "shipping_addresses",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        fullName: text("full_name").notNull(),
        phone: text("phone").notNull(),
        addressLine1: text("address_line1").notNull(),
        addressLine2: text("address_line2"),
        city: text("city").notNull(),
        state: text("state").notNull(),
        postalCode: text("postal_code").notNull(),
        country: text("country").notNull().default("India"),
        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", {
            withTimezone: true,
            mode: "date",
        }).notNull().defaultNow(),
    },
    (t) => [index("shipping_addresses_user_idx").on(t.userId)]
);

export const orders = pgTable(
    "orders",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, { onDelete: "restrict" }),
        addressId: uuid("address_id")
            .references(() => addresses.id, { onDelete: "set null" }),
        // Snapshot: the address can be edited later without changing old orders.
        shippingAddress: jsonb("shipping_address").notNull(),

        subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),

        currency: text("currency").notNull().default("inr"),
        status: orderStatusEnum("status").notNull().default("pending"),

        paymentStatus: paymentStatusEnum("payment_status")
            .notNull().default("pending"),
        paymentIntentId: text("payment_intent_id").unique(),

        reservationExpiresAt: timestamp("reservation_expires_at", {
            withTimezone: true,
            mode: "date",
        }).defaultNow(),

        paymentMethod: paymentMethodEnum("payment_method")
            .notNull()
            .default("cod"),
        
        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        }).notNull().defaultNow(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
            mode: "date",
        }).notNull().defaultNow(),
    },
    (t) => [
        index("orders_user_idx").on(t.userId),
        index("orders_status_idx").on(t.status),
    ]
);

export const orderItems = pgTable(
    "order_items",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        orderId: uuid("order_id")
            .notNull().references(() => orders.id, { onDelete: "cascade" }),
        vendorId: uuid("vendor_id")
            .notNull().references(() => vendors.id, { onDelete: "restrict" }),
        listingId: uuid("listing_id")
            .notNull().references(() => vendorProductSchema.id, {
                onDelete: "restrict",
            }),
        productId: uuid("product_id").notNull(),
        productName: text("product_name").notNull(),
        quantity: integer("quantity").notNull(),
        unitPrice: numeric("unit_price", {
            precision: 12,
            scale: 2,
        }).notNull(),
        lineTotal: numeric("line_total", {
            precision: 12,
            scale: 2,
        }).notNull(),
        fulfillmentStatus: vendorFulfillmentStatusEnum("fulfillment_status")
            .notNull().default("pending"),
        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        }).notNull().defaultNow(),
    },
    (t) => [
        index("order_items_order_idx").on(t.orderId),
        index("order_items_vendor_idx").on(t.vendorId),
        check("order_items_quantity_positive", sql`${t.quantity} > 0`),
    ]
);
