import {
    pgTable,
    uuid,
    timestamp,
} from "drizzle-orm/pg-core";

import { users } from "./users";

export const cartSchema = pgTable("carts", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    customerId: uuid("user_id")
        .notNull()
        .unique()
        .references(() => users.id, {
            onDelete: "cascade",
        }),

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
});
