ALTER TABLE "orders" ADD COLUMN "razorpay_order_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "razorpay_payment_id" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_razorpay_order_id_unique" UNIQUE("razorpay_order_id");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_razorpay_payment_id_unique" UNIQUE("razorpay_payment_id");