import {
    pgTable,
    uuid,
    varchar,
    jsonb,
    timestamp,
} from "drizzle-orm/pg-core";

import { vendors } from "./vendor";

export const vendorProfiles = pgTable("vendor_profiles", {
    vendorId: uuid("vendor_id")
        .primaryKey()
        .references(() => vendors.id, {
            onDelete: "cascade",
        }),

    companyName: varchar("company_name", {
        length: 150,
    }),

    taxId: varchar("tax_id", {
        length: 100,
    }),

    businessAddress: jsonb("business_address"),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    })
        .notNull()
        .defaultNow(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
    })
        .notNull()
        .defaultNow(),
});