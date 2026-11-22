import {
    boolean,
    check,
    index,
    integer,
    pgEnum,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { productSchema } from "./product-schema";
import { vendorProductSchema } from "./vendor-product-schema";

export const productImageSourceEnum = pgEnum("product_image_source", [
    "admin",
    "vendor",
]);

export const productImages = pgTable(
    "product_images",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        productId: uuid("product_id").references(() => productSchema.id, {
            onDelete: "cascade",
        }),
        vendorProductId: uuid("vendor_product_id").references(
            () => vendorProductSchema.id,
            { onDelete: "cascade" }
        ),
        source: productImageSourceEnum("source").notNull(),
        imageUrl: text("image_url").notNull(),
        publicId: text("public_id"),
        sortOrder: integer("sort_order").notNull().default(0),
        isPrimary: boolean("is_primary").notNull().default(false),
        createdAt: timestamp("created_at", {
            withTimezone: true,
            mode: "date",
        })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        check(
            "product_images_owner_source_check",
            sql`(${table.source} = 'admin' AND ${table.productId} IS NOT NULL AND ${table.vendorProductId} IS NULL) OR (${table.source} = 'vendor' AND ${table.productId} IS NULL AND ${table.vendorProductId} IS NOT NULL)`
        ),
        check(
            "product_images_sort_order_check",
            sql`${table.sortOrder} >= 0`
        ),
        index("product_images_product_order_idx").on(
            table.productId,
            table.sortOrder
        ),
        index("product_images_vendor_product_order_idx").on(
            table.vendorProductId,
            table.sortOrder
        ),
        uniqueIndex("product_images_admin_url_unique")
            .on(table.productId, table.imageUrl)
            .where(sql`${table.source} = 'admin'`),
        uniqueIndex("product_images_vendor_url_unique")
            .on(table.vendorProductId, table.imageUrl)
            .where(sql`${table.source} = 'vendor'`),
        uniqueIndex("product_images_admin_primary_unique")
            .on(table.productId)
            .where(sql`${table.source} = 'admin' AND ${table.isPrimary} = true`),
        uniqueIndex("product_images_vendor_primary_unique")
            .on(table.vendorProductId)
            .where(
                sql`${table.source} = 'vendor' AND ${table.isPrimary} = true`
            ),
    ]
);
