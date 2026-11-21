CREATE TYPE "public"."contact_status" AS ENUM('new', 'in_progress', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."contact_subject" AS ENUM('order', 'returns', 'product', 'vendor', 'feedback', 'other');--> statement-breakpoint
CREATE TABLE "contact_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"full_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"subject" "contact_subject" NOT NULL,
	"order_ref" text,
	"message" text NOT NULL,
	"status" "contact_status" DEFAULT 'new' NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "contact_messages" ADD CONSTRAINT "contact_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "contact_messages_user_idx" ON "contact_messages" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "contact_messages_email_idx" ON "contact_messages" USING btree ("email");--> statement-breakpoint
CREATE INDEX "contact_messages_status_idx" ON "contact_messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "contact_messages_created_idx" ON "contact_messages" USING btree ("created_at");