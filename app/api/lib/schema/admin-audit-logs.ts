import { pgTable, uuid, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { adminAccounts } from "./admin-schema";

export const adminAuditLogs = pgTable("admin_audit_logs", {
    id: uuid("id").defaultRandom().primaryKey(),
    adminId: uuid("admin_id").references(() => adminAccounts.id, { onDelete: "set null" }),
    action: varchar("action", { length: 50 }).notNull(), // user.block | user.unblock | user.delete
    targetType: varchar("target_type", { length: 30 }).notNull(), // "user"
    targetId: uuid("target_id").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});