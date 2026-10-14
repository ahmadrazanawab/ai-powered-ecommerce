import {pgTable,uuid,varchar,text,boolean,timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
// id | category_id | name | slug | sku | description | price |
// stock | image_url | is_active | created_by | created_at |
// updated_at

export const productSchema = pgTable("products", {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: varchar("text")
});
