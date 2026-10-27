import { pgTable, uuid, varchar, boolean, text, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { adminAccounts } from "./admin-schema";

const users = pgTable(
    "users",
    {
        id: uuid("id").defaultRandom().primaryKey(),
        name: varchar("name", { length: 100 }),
        email: varchar("email", { length: 255 }).unique(),
        mobileNo: varchar("mobile_number", { length: 15 }).unique(),
        isVerified: boolean("is_verified").notNull().default(false),

        // --- new: admin moderation ---
        isBlocked: boolean("is_blocked").notNull().default(false),
        blockedReason: text("blocked_reason"),
        blockedAt: timestamp("blocked_at", { withTimezone: true }),
        blockedBy: uuid("blocked_by").references(() => adminAccounts.id, {
            onDelete: "set null",
        }),
        deletedAt: timestamp("deleted_at", { withTimezone: true }), // soft delete (super_admin only)
        lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

        createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
        updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    },
    (table) => [
        check(
            "users_email_or_mobile",
            sql`${table.mobileNo} IS NOT NULL or ${table.email} IS NOT NULL`
        ),
    ]
);

export { users };



// import {
//     pgTable, uuid, varchar,
//     boolean, timestamp, check, text
// } from "drizzle-orm/pg-core";

// import { sql } from "drizzle-orm";
// import { adminAccounts } from "./admin-schema";
// const users = pgTable("users", {
//     id: uuid("id").defaultRandom().primaryKey(),
//     name: varchar("name", { length: 100 }),
//     email: varchar("email", { length: 255 }).unique(),
//     mobileNo: varchar("mobile_number", { length: 15 }).unique(),
//     isVerified: boolean('is_verified').notNull().default(false),
//     createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
//     updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
//     isBlocked: boolean("is_blocked").notNull().default(false),
//     blockedReason: text("blocked_reason"),
//     blockedAt: timestamp("blocked_at", { withTimezone: true }),
//     blockedBy: uuid("blocked_by").references(() => adminAccounts.id, { onDelete: "set null" }),
//     deletedAt: timestamp("deleted_at", { withTimezone: true }),
//     lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
// },
//     (table) => [
//         check(
//             "users_email_or_mobile",
//             sql`${table.mobileNo} IS NOT NULL or ${table.email} IS NOT NULL`
//         )
//     ]
// )

// export { users };