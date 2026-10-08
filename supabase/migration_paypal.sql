-- OmniTrust Stage 2 - PayPal Sandbox Transaction Schema Migration
-- Run this in your Supabase SQL Editor (Dashboard -> SQL Editor)

-- 1. Add PayPal payment columns to transactions table
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS product TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS paypal_order_id TEXT;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS paypal_capture_id TEXT;

-- 2. Create index on paypal_order_id for fast lookup
CREATE INDEX IF NOT EXISTS idx_transactions_paypal_order_id ON public.transactions(paypal_order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_paypal_capture_id ON public.transactions(paypal_capture_id);

-- 3. Grant INSERT privileges to anon and authenticated roles (used by backend)
GRANT INSERT ON TABLE public.transactions TO anon, authenticated;

-- 4. Enable RLS insert policy
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow insert access for transactions'
    ) THEN
        CREATE POLICY "Allow insert access for transactions" ON public.transactions FOR INSERT WITH CHECK (true);
    END IF;
END $$;
