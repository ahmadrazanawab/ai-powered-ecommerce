// file : app/api/lib/schema/contact-schema.ts
import {
  pgTable,
  uuid,
  text,
  timestamp,
  pgEnum,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const contactSubjectEnum = pgEnum("contact_subject", [
  "order",
  "returns",
  "product",
  "vendor",
  "feedback",
  "other",
]);

export const contactStatusEnum = pgEnum("contact_status", [
  "new",
  "in_progress",
  "resolved",
]);

export const contactMessages = pgTable(
  "contact_messages",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    // null = sent by a guest. Set when the customer was logged in.
    userId: uuid("user_id").references(() => users.id, {
      onDelete: "set null",
    }),

    fullName: text("full_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    subject: contactSubjectEnum("subject").notNull(),

    // The order number exactly as the person typed it (e.g. "#A1B2C3D4").
    orderRef: text("order_ref"),
    message: text("message").notNull(),

    status: contactStatusEnum("status").notNull().default("new"),

    // Used only for rate limiting / abuse checks.
    ipAddress: text("ip_address"),

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
  (t) => [
    index("contact_messages_user_idx").on(t.userId),
    index("contact_messages_email_idx").on(t.email),
    index("contact_messages_status_idx").on(t.status),
    index("contact_messages_created_idx").on(t.createdAt),
  ]
);