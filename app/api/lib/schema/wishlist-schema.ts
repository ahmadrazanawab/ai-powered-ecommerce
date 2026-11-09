// file : app/api/lib/schema/wishlist-schema.ts

import {
    pgTable,
    uuid,
    timestamp,
    unique,
    index,
} from "drizzle-orm/pg-core";

import { users } from "./users";
import { vendorProductSchema } from "./vendor-product-schema";

export const wishlistItems = pgTable(
    "wishlist_items",
    {
        id: uuid("id").defaultRandom().primaryKey(),

        userId: uuid("user_id")
            .notNull()
            .references(() => users.id, {
                onDelete: "cascade",
            }),

        listingId: uuid("listing_id")
            .notNull()
            .references(() => vendorProductSchema.id, {
                onDelete: "cascade",
            }),

        createdAt: timestamp("created_at", {
            withTimezone: true,
        })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        unique("wishlist_user_listing_unique").on(
            table.userId,
            table.listingId
        ),
        index("wishlist_user_idx").on(table.userId),
    ]
);


// import { pgTable, uuid, timestamp, index, unique } from "drizzle-orm/pg-core";
// import { users } from "./users";
// import { vendorProductSchema } from "./vendor-product-schema";

// export const wishlistItems = pgTable(
//     "wishlist_items",
//     {
//         id: uuid("id").defaultRandom().primaryKey(),
//         userId: uuid("user_id")
//             .notNull()
//             .references(() => users.id, { onDelete: "cascade" }),
//         // the saved vendor listing (same id the cart uses)
//         listingId: uuid("listing_id")
//             .notNull()
//             .references(() => vendorProductSchema.id, { onDelete: "cascade" }),
//         createdAt: timestamp("created_at", {
//             withTimezone: true,
//             mode: "date",
//         })
//             .notNull()
//             .defaultNow(),
//     },
//     (t) => [
//         // a listing can be saved once per customer
//         unique("wishlist_user_listing_unique").on(t.userId, t.listingId),
//         index("wishlist_user_idx").on(t.userId),
//     ]
// );