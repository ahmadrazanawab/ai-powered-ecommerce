import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  timestamp,
  pgEnum
} from "drizzle-orm/pg-core";

// 1. Matches your Postgres ENUM type definition
export const otpPurposeEnum = pgEnum("otp_purpose", [
  "login",
  "signup",
  "reset_password",
  "change_email",
  "change_phone"
]);

export const otpCodes = pgTable("otp_codes", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: varchar("identifier", { length: 255 }).notNull(), // Added length constraint
  codeHash: text("code_hash").notNull(),                         // Changed from varchar to text
  purpose: otpPurposeEnum("purpose").default("login").notNull(),
  attempts: smallint("attempts").default(0).notNull(),           // Changed from varchar to smallint
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // Changed from number to timestamp
  usedAt: timestamp("used_at", { withTimezone: true }),                 // Changed from number to timestamp
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull()
});
