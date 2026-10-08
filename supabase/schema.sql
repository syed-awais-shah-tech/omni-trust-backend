-- Enable pgcrypto extension for gen_random_uuid() if not already available
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Create 'policies' table
CREATE TABLE IF NOT EXISTS public.policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create 'transactions' table
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status TEXT NOT NULL DEFAULT 'pending',
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'USD',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Basic useful indexes
CREATE INDEX IF NOT EXISTS idx_policies_created_at ON public.policies(created_at);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.transactions(status);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.transactions(created_at);

-- Grant table privileges to roles
GRANT ALL ON TABLE public.policies TO postgres, service_role;
GRANT ALL ON TABLE public.transactions TO postgres, service_role;

GRANT SELECT ON TABLE public.policies TO anon, authenticated;
GRANT SELECT ON TABLE public.transactions TO anon, authenticated;

-- Row Level Security (RLS) setup
ALTER TABLE public.policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated & anon clients
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'policies' AND policyname = 'Allow public read access for policies'
    ) THEN
        CREATE POLICY "Allow public read access for policies" ON public.policies FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'transactions' AND policyname = 'Allow public read access for transactions'
    ) THEN
        CREATE POLICY "Allow public read access for transactions" ON public.transactions FOR SELECT USING (true);
    END IF;
END $$;
