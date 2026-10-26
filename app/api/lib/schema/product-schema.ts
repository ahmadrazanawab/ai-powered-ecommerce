
import {
    pgTable,
    uuid,
    varchar,
    text,
    boolean,
    timestamp,
    numeric,
    integer,
    unique,
} from "drizzle-orm/pg-core";

import { categorySchema } from "./category-schema";
import { adminAccounts } from "./admin-schema";


export const productSchema = pgTable("products", {
    id: uuid("id").defaultRandom().primaryKey(),

    categoryId: uuid("category_id")
        .notNull()
        .references(() => categorySchema.id, {
            onDelete: "restrict",
        }),

    name: varchar("name", { length: 200 }).notNull(),

    slug: varchar("slug", { length: 220 }).notNull().unique(),

    sku: varchar("sku", { length: 100 }).notNull().unique(),

    description: text("description"),

    price: numeric("price", {
        precision: 10,
        scale: 2,
    }).notNull(),

    stock: integer("stock").notNull().default(0),

    imageUrl: text("image_url"),

    isActive: boolean("is_active").notNull().default(true),

    createdBy: uuid("created_by").references(() => adminAccounts.id, {
        onDelete: "set null",
    }),

    createdAt: timestamp("created_at", {
        withTimezone: true,
        mode: "date",
    }).notNull().defaultNow(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
        mode: "date",
    }).notNull().defaultNow(),
});



