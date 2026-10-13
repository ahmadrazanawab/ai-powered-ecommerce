import {
    pgTable,
    uuid,
    varchar,
    text,
    timestamp,
    pgEnum,
    boolean,
} from "drizzle-orm/pg-core";

import { adminAccounts } from "./admin";

export const vendorStatusEnum = pgEnum("vendor_status", [
    "pending",
    "approved",
    "rejected",
    "suspended",
]);

export const vendors = pgTable("vendors", {
    id: uuid("id")
        .defaultRandom()
        .primaryKey(),

    name: varchar("name", {
        length: 100,
    }).notNull(),

    email: varchar("email", {
        length: 255,
    }).notNull().unique(),

    mobileNumber: varchar("mobile_number", {
        length: 15,
    }).unique(),

    passwordHash: text("password_hash").notNull(),

    status: vendorStatusEnum("status")
        .notNull()
        .default("pending"),

    approvedBy: uuid("approved_by").references(
        () => adminAccounts.id,
        {
            onDelete: "set null",
        }
    ),

    isActive: boolean("is_active")
        .notNull()
        .default(false),

    approvedAt: timestamp("approved_at", {
        withTimezone: true,
    }),

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