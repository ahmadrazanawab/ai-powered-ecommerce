CREATE TYPE "public"."invoice_generation_job_status" AS ENUM('pending', 'processing', 'failed', 'completed');--> statement-breakpoint
CREATE TYPE "public"."seller_invoice_status" AS ENUM('blocked', 'pending', 'generating', 'ready', 'failed');--> statement-breakpoint
CREATE TYPE "public"."seller_invoice_type" AS ENUM('tax_invoice', 'bill_of_supply', 'commercial_invoice');--> statement-breakpoint
CREATE TABLE "invoice_generation_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"status" "invoice_generation_job_status" DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"last_error" varchar(500),
	"locked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_generation_jobs_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
CREATE TABLE "seller_invoice_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"order_item_id" uuid,
	"line_number" integer NOT NULL,
	"product_name" text NOT NULL,
	"hsn_code" varchar(8),
	"quantity" integer NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount_amount" numeric(12, 2) DEFAULT '0.00' NOT NULL,
	"taxable_amount" numeric(12, 2) NOT NULL,
	"gst_rate" numeric(5, 2) NOT NULL,
	"cgst_amount" numeric(12, 2) NOT NULL,
	"sgst_amount" numeric(12, 2) NOT NULL,
	"igst_amount" numeric(12, 2) NOT NULL,
	"total_tax" numeric(12, 2) NOT NULL,
	"line_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seller_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
	"invoice_number" varchar(16),
	"financial_year" integer,
	"sequence_number" integer,
	"invoice_date" timestamp with time zone,
	"invoice_type" "seller_invoice_type",
	"status" "seller_invoice_status" DEFAULT 'blocked' NOT NULL,
	"blocked_reason" varchar(80),
	"currency" varchar(3) DEFAULT 'INR' NOT NULL,
	"seller_snapshot" jsonb,
	"customer_snapshot" jsonb,
	"totals_snapshot" jsonb,
	"pdf_storage_key" text,
	"generated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendor_product_tax_profiles" (
	"vendor_product_id" uuid PRIMARY KEY NOT NULL,
	"hsn_code" varchar(8) NOT NULL,
	"gst_rate" numeric(5, 2) NOT NULL,
	"updated_by" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "hsn_code" varchar(8);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "gst_rate" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "taxable_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "cgst_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "sgst_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "igst_amount" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "total_tax" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "invoice_generation_jobs" ADD CONSTRAINT "invoice_generation_jobs_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_invoice_items" ADD CONSTRAINT "seller_invoice_items_invoice_id_seller_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."seller_invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_invoice_items" ADD CONSTRAINT "seller_invoice_items_order_item_id_order_items_id_fk" FOREIGN KEY ("order_item_id") REFERENCES "public"."order_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_invoices" ADD CONSTRAINT "seller_invoices_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seller_invoices" ADD CONSTRAINT "seller_invoices_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_product_tax_profiles" ADD CONSTRAINT "vendor_product_tax_profiles_vendor_product_id_vendor_products_id_fk" FOREIGN KEY ("vendor_product_id") REFERENCES "public"."vendor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_product_tax_profiles" ADD CONSTRAINT "vendor_product_tax_profiles_updated_by_admins_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."admins"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_generation_jobs_status_updated_idx" ON "invoice_generation_jobs" USING btree ("status","updated_at");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_invoice_items_invoice_line_unique" ON "seller_invoice_items" USING btree ("invoice_id","line_number");--> statement-breakpoint
CREATE INDEX "seller_invoice_items_invoice_idx" ON "seller_invoice_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_invoices_order_vendor_unique" ON "seller_invoices" USING btree ("order_id","vendor_id");--> statement-breakpoint
CREATE UNIQUE INDEX "seller_invoices_vendor_number_unique" ON "seller_invoices" USING btree ("vendor_id","invoice_number") WHERE "seller_invoices"."invoice_number" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "seller_invoices_vendor_year_sequence_unique" ON "seller_invoices" USING btree ("vendor_id","financial_year","sequence_number") WHERE "seller_invoices"."sequence_number" IS NOT NULL;--> statement-breakpoint
CREATE INDEX "seller_invoices_order_status_idx" ON "seller_invoices" USING btree ("order_id","status");--> statement-breakpoint
CREATE INDEX "seller_invoices_vendor_created_idx" ON "seller_invoices" USING btree ("vendor_id","created_at");