import {
  pgTable,
  uuid,
  numeric,
  integer,
  boolean,
  timestamp,
  unique,
  index,
} from "drizzle-orm/pg-core";

import { vendors } from "./vendor";
import { productSchema } from "./product-schema";

export const vendorProductSchema = pgTable(
  "vendor_products",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),

    productId: uuid("product_id")
      .notNull()
      .references(() => productSchema.id, { onDelete: "cascade" }),

    // Vendor-specific selling price
    price: numeric("price", {
      precision: 10,
      scale: 2,
    }).notNull(),

    // Stock available from this vendor
    stock: integer("stock").notNull().default(0),

    // Whether this vendor's listing is available
    isActive: boolean("is_active").notNull().default(true),

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
    // A vendor can list a given catalog product only once
    unique("vendor_products_vendor_product_unique").on(
      table.vendorId,
      table.productId
    ),

    // Useful for fetching all listings belonging to a vendor
    index("vendor_products_vendor_id_idx").on(table.vendorId),

    // Useful for finding vendors selling a particular product
    index("vendor_products_product_id_idx").on(table.productId),
  ]
);