import {
  pgTable,
  uuid,
  varchar,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),

  name: varchar("name", {
    length: 100,
  }),

  email: varchar("email", {
    length: 255,
  }).unique(),

  mobileNumber: varchar("mobile_number", {
    length: 15,
  }).unique(),

  role: varchar("role", {
    length: 20,
  })
    .notNull()
    .default("customer"),

  isVerified: boolean("is_verified")
    .notNull()
    .default(false),

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