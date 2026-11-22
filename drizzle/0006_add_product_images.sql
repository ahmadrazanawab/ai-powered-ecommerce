CREATE TYPE "public"."product_image_source" AS ENUM('admin', 'vendor');--> statement-breakpoint
CREATE TABLE "product_images" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid,
	"vendor_product_id" uuid,
	"source" "product_image_source" NOT NULL,
	"image_url" text NOT NULL,
	"public_id" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_images_owner_source_check" CHECK (("product_images"."source" = 'admin' AND "product_images"."product_id" IS NOT NULL AND "product_images"."vendor_product_id" IS NULL) OR ("product_images"."source" = 'vendor' AND "product_images"."product_id" IS NULL AND "product_images"."vendor_product_id" IS NOT NULL)),
	CONSTRAINT "product_images_sort_order_check" CHECK ("product_images"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_images" ADD CONSTRAINT "product_images_vendor_product_id_vendor_products_id_fk" FOREIGN KEY ("vendor_product_id") REFERENCES "public"."vendor_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_images_product_order_idx" ON "product_images" USING btree ("product_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_images_vendor_product_order_idx" ON "product_images" USING btree ("vendor_product_id","sort_order");--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_admin_url_unique" ON "product_images" USING btree ("product_id","image_url") WHERE "product_images"."source" = 'admin';--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_vendor_url_unique" ON "product_images" USING btree ("vendor_product_id","image_url") WHERE "product_images"."source" = 'vendor';--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_admin_primary_unique" ON "product_images" USING btree ("product_id") WHERE "product_images"."source" = 'admin' AND "product_images"."is_primary" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "product_images_vendor_primary_unique" ON "product_images" USING btree ("vendor_product_id") WHERE "product_images"."source" = 'vendor' AND "product_images"."is_primary" = true;
--> statement-breakpoint
INSERT INTO "product_images" (
	"product_id",
	"source",
	"image_url",
	"public_id",
	"sort_order",
	"is_primary"
)
SELECT
	"products"."id",
	'admin',
	"products"."image_url",
	CASE
		WHEN "products"."image_url" LIKE 'https://res.cloudinary.com/%/image/upload/%'
		THEN regexp_replace(
			regexp_replace(
				substring("products"."image_url" from '/image/upload/(.*)$'),
				'^v[0-9]+/',
				''
			),
			'\.[^./]+$',
			''
		)
		ELSE NULL
	END,
	0,
	TRUE
FROM "products"
WHERE "products"."image_url" IS NOT NULL
	AND btrim("products"."image_url") <> ''
ON CONFLICT DO NOTHING;