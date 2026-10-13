import { pgTable, uuid, varchar, boolean, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }),
    email: varchar("email", { length: 255 }).unique(),
    mobileNo: varchar("mobile_number", { length: 15 }).unique(),
    isVerified: boolean('is_verified').notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
},
    (table) => [
        check(
            "users_email_or_mobile",
            sql`${table.mobileNo} IS NOT NULL or ${table.email} IS NOT NULL`
        )
    ]
) 

export { users };