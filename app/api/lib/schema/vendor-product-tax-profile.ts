import {
    numeric,
    pgTable,
    timestamp,
    uuid,
    varchar,
} from "drizzle-orm/pg-core";

import { adminAccounts } from "./admin-schema";
import { vendorProductSchema } from "./vendor-product-schema";

export const vendorProductTaxProfiles = pgTable(
    "vendor_product_tax_profiles",
    {
        vendorProductId: uuid("vendor_product_id")
            .primaryKey()
            .references(() => vendorProductSchema.id, { onDelete: "cascade" }),
        hsnCode: varchar("hsn_code", { length: 8 }).notNull(),
        gstRate: numeric("gst_rate", { precision: 5, scale: 2 }).notNull(),
        updatedBy: uuid("updated_by")
            .notNull()
            .references(() => adminAccounts.id, { onDelete: "restrict" }),
        updatedAt: timestamp("updated_at", { withTimezone: true })
            .notNull()
            .defaultNow(),
    }
);
