// db/schema/admin.ts

import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

// admin_accounts
export const adminAccounts = pgTable("admins", {
  id: uuid("id").defaultRandom().primaryKey(),

  email: varchar("email", { length: 255 })
    .notNull()
    .unique(),

  passwordHash: varchar("password_hash", {
    length: 255,
  }).notNull(),

  role: varchar("role", {
    length: 30,
  }).notNull().default("admin"),

  isActive: boolean("is_active")
    .notNull()
    .default(true),

  createdAt: timestamp("created_at", {
    withTimezone: true,
  }).defaultNow().notNull(),

  updatedAt: timestamp("updated_at", {
    withTimezone: true,
  }).defaultNow().notNull(),
});