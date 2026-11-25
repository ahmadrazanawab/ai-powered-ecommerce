CREATE TYPE "public"."vendor_business_type" AS ENUM('proprietorship', 'partnership', 'llp', 'private_limited', 'public_limited', 'other');--> statement-breakpoint
CREATE TYPE "public"."vendor_business_verification_status" AS ENUM('pending', 'under_review', 'verified', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."vendor_gst_registration_status" AS ENUM('regular', 'composition', 'unregistered');--> statement-breakpoint
CREATE TABLE "vendor_business_profiles" (
	"vendor_id" uuid PRIMARY KEY NOT NULL,
	"business_name" varchar(150) NOT NULL,
	"business_type" "vendor_business_type" NOT NULL,
	"authorized_person_name" varchar(150) NOT NULL,
	"business_email" varchar(255) NOT NULL,
	"business_phone" varchar(15) NOT NULL,
	"gst_registration_status" "vendor_gst_registration_status" DEFAULT 'unregistered' NOT NULL,
	"gstin" varchar(15),
	"pan" varchar(10) NOT NULL,
	"gst_document_public_id" text,
	"gst_document_format" varchar(10),
	"address_line_1" varchar(200) NOT NULL,
	"address_line_2" varchar(200),
	"city" varchar(100) NOT NULL,
	"state" varchar(100) NOT NULL,
	"pin_code" varchar(6) NOT NULL,
	"country" varchar(100) DEFAULT 'India' NOT NULL,
	"invoice_display_name" varchar(150) NOT NULL,
	"invoice_prefix" varchar(20),
	"payment_information" text,
	"verification_status" "vendor_business_verification_status" DEFAULT 'pending' NOT NULL,
	"rejection_reason" varchar(1000),
	"review_message" varchar(1000),
	"reviewed_by" uuid,
	"reviewed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "vendor_business_profiles" ADD CONSTRAINT "vendor_business_profiles_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_business_profiles" ADD CONSTRAINT "vendor_business_profiles_reviewed_by_admins_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."admins"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_business_profiles_verification_idx" ON "vendor_business_profiles" USING btree ("verification_status","created_at");