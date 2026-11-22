ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "payment_session_id" text;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'orders_payment_session_id_unique'
          AND conrelid = 'public.orders'::regclass
    ) THEN
        ALTER TABLE "orders"
        ADD CONSTRAINT "orders_payment_session_id_unique"
        UNIQUE ("payment_session_id");
    END IF;
END $$;