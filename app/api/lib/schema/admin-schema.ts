// db/admin-schema/signup.ts
import {
    pgTable,
    uuid,
    varchar,
    boolean,
    timestamp,
    text,
} from "drizzle-orm/pg-core";

export const adminAccounts = pgTable("admins", {
    id: uuid("id").defaultRandom().primaryKey(),

    name: varchar("name", {
        length: 100,
    }).notNull(),

    email: varchar("email", {
        length: 255,
    }).notNull().unique(),

    phoneNumber: varchar("phone_number", {
        length: 15,
    }).unique(),

    passwordHash: text("password_hash").notNull(),

    role: varchar("role", {
        length: 30,
    })
        .notNull()
        .default("admin"),

    isVerified: boolean("is_verified")
        .notNull()
        .default(false),

    status: varchar("status", {
        length: 20,
    })
        .notNull()
        .default("pending"),

    rejectionReason: text("rejection_reason"),

    approvedBy: uuid("approved_by"),

    approvedAt: timestamp("approved_at", {
        withTimezone: true,
    }),

    isActive: boolean("is_active")
        .notNull()
        .default(false),

    createdAt: timestamp("created_at", {
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),

    updatedAt: timestamp("updated_at", {
        withTimezone: true,
    })
        .defaultNow()
        .notNull(),
});