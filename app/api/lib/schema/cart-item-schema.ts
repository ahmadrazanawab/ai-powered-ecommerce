import {
    pgTable,
    uuid,
    integer,
    timestamp,
    unique,
    check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { cartSchema } from "./cart-schema";
import { vendorProductSchema } from "./vendor-product-schema";

export const cartItemSchema = pgTable(
    "cart_items",
    {
        id: uuid("id")
            .defaultRandom()
            .primaryKey(),

        cartId: uuid("cart_id")
            .notNull()
            .references(() => cartSchema.id, {
                onDelete: "cascade",
            }),

        listingId: uuid("listing_id")
            .notNull()
            .references(() => vendorProductSchema.id, {
                onDelete: "cascade",
            }),

        quantity: integer("quantity")
            .notNull()
            .default(1),

        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),

        updatedAt: timestamp("updated_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        unique("cart_items_cart_listing_unique").on(
            table.cartId,
            table.listingId
        ),

        check(
            "cart_items_quantity_positive",
            sql`${table.quantity} > 0`
        ),
    ]
);