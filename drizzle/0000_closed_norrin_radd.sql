CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cod', 'online');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'processing', 'paid', 'succeeded', 'failed', 'refunded', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."vendor_fulfillment_status" AS ENUM('pending', 'processing', 'shipped', 'delivered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."refund_method" AS ENUM('cash', 'bank_transfer', 'original_payment_method', 'other');--> statement-breakpoint
CREATE TYPE "public"."refund_status" AS ENUM('pending', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."otp_purpose" AS ENUM('login', 'signup', 'reset_password', 'change_email', 'change_phone');--> statement-breakpoint
CREATE TYPE "public"."vendor_status" AS ENUM('pending', 'approved', 'rejected', 'suspended');--> statement-breakpoint
CREATE TABLE "admin_audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_id" uuid,
	"action" varchar(50) NOT NULL,
	"target_type" varchar(30) NOT NULL,
	"target_id" uuid NOT NULL,
	"reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"phone_number" varchar(15),
	"password_hash" text NOT NULL,
	"role" varchar(30) DEFAULT 'admin' NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"rejection_reason" text,
	"approved_by" uuid,
	"approved_at" timestamp with time zone,
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admins_email_unique" UNIQUE("email"),
	CONSTRAINT "admins_phone_number_unique" UNIQUE("phone_number")
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cart_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cart_items_cart_listing_unique" UNIQUE("cart_id","listing_id"),
	CONSTRAINT "cart_items_quantity_positive" CHECK ("cart_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "carts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "carts_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"slug" varchar(120) NOT NULL,
	"description" text,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_unique" UNIQUE("name"),
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "shipping_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"phone" text NOT NULL,
	"address_line1" text NOT NULL,
	"address_line2" text,
	"city" text NOT NULL,
	"state" text NOT NULL,
	"postal_code" text NOT NULL,
	"country" text DEFAULT 'India' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"product_name" text NOT NULL,
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"fulfillment_status" "vendor_fulfillment_status" DEFAULT 'pending' NOT NULL,
	"stock_restored" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"address_id" uuid,
	"shipping_address" jsonb NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"currency" text DEFAULT 'inr' NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_intent_id" text,
	"reservation_expires_at" timestamp with time zone DEFAULT now(),
	"payment_method" "payment_method" DEFAULT 'cod' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_payment_intent_id_unique" UNIQUE("payment_intent_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"slug" varchar(220) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"description" text,
	"price" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"image_url" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_slug_unique" UNIQUE("slug"),
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "user_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"full_name" varchar(100),
	"shipping_address" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_profiles" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"company_name" varchar(150),
	"tax_id" varchar(100),
	"business_address" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"method" "refund_method" NOT NULL,
	"status" "refund_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"processed_by" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "otp_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"code_hash" text NOT NULL,
	"purpose" "otp_purpose" DEFAULT 'login' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100),
	"email" varchar(255),
	"mobile_number" varchar(15),
	"is_verified" boolean DEFAULT false NOT NULL,
	"is_blocked" boolean DEFAULT false NOT NULL,
	"blocked_reason" text,
	"blocked_at" timestamp with time zone,
	"blocked_by" uuid,
	"deleted_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_mobile_number_unique" UNIQUE("mobile_number"),
	CONSTRAINT "users_email_or_mobile" CHECK ("users"."mobile_number" IS NOT NULL or "users"."email" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "vendor_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"vendor_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_products_vendor_product_unique" UNIQUE("vendor_id","product_id")
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"mobile_number" varchar(15),
	"password_hash" text NOT NULL,
	"status" "vendor_status" DEFAULT 'pending' NOT NULL,
	"approved_by" uuid,
	"is_active" boolean DEFAULT false NOT NULL,
	"rejection_reason" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_email_unique" UNIQUE("email"),
	CONSTRAINT "vendors_mobile_number_unique" UNIQUE("mobile_number")
);
--> statement-breakpoint
CREATE TABLE "wishlist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wishlist_user_listing_unique" UNIQUE("user_id","listing_id")
);
--> statement-breakpoint
ALTER TABLE "admin_audit_logs" ADD CONSTRAINT "admin_audit_logs_admin_id_admins_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_cart_id_carts_id_fk" FOREIGN KEY ("cart_id") REFERENCES "public"."carts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_listing_id_vendor_products_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vendor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carts" ADD CONSTRAINT "carts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shipping_addresses" ADD CONSTRAINT "shipping_addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_listing_id_vendor_products_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vendor_products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_address_id_shipping_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."shipping_addresses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_created_by_admins_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_refunds" ADD CONSTRAINT "order_refunds_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_blocked_by_admins_id_fk" FOREIGN KEY ("blocked_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_products" ADD CONSTRAINT "vendor_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendors" ADD CONSTRAINT "vendors_approved_by_admins_id_fk" FOREIGN KEY ("approved_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_items" ADD CONSTRAINT "wishlist_items_listing_id_vendor_products_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."vendor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipping_addresses_user_idx" ON "shipping_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "order_items_vendor_idx" ON "order_items" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "orders_user_idx" ON "orders" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "order_refunds_order_idx" ON "order_refunds" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "vendor_products_vendor_id_idx" ON "vendor_products" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendor_products_product_id_idx" ON "vendor_products" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist_items" USING btree ("user_id");