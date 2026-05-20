BEGIN;

-- A. Create the master granular delivery ledger table
CREATE TABLE IF NOT EXISTS public.delivery_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE NOT NULL,
  delivery_date DATE NOT NULL,
  product_slug TEXT NOT NULL, -- Cached identifier for quick lookups
  quantity INT NOT NULL DEFAULT 1,
  effective_price NUMERIC(10,2) NOT NULL, -- Locked rate based on subscription tier/VIP status
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'delivered', 'paused', 'skipped', 'failed', 'pending_payment', 'cancelled')),
  delivery_partner_id UUID REFERENCES public.profiles(id) DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- B. Create a unique constraint to ensure a single subscription cannot generate duplicate rows on the same date
DROP INDEX IF EXISTS idx_unique_sub_date_ledger;
CREATE UNIQUE INDEX idx_unique_sub_date_ledger 
ON public.delivery_ledger (subscription_id, delivery_date);

-- C. Enable Row-Level Security
ALTER TABLE public.delivery_ledger ENABLE ROW LEVEL SECURITY;

-- D. Create precise RLS Security Policies
DROP POLICY IF EXISTS "Users can view their own delivery ledger" ON public.delivery_ledger;
CREATE POLICY "Users can view their own delivery ledger" ON public.delivery_ledger
  FOR SELECT TO authenticated USING (
    subscription_id IN (SELECT id FROM public.subscriptions WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

DROP POLICY IF EXISTS "Users can update future delivery ledger entries" ON public.delivery_ledger;
CREATE POLICY "Users can update future delivery ledger entries" ON public.delivery_ledger
  FOR UPDATE TO authenticated 
  USING (
    subscription_id IN (SELECT id FROM public.subscriptions WHERE user_id = auth.uid())
    AND delivery_date > CURRENT_DATE
  )
  WITH CHECK (
    status IN ('scheduled', 'skipped') -- Users can only toggle between scheduled and skipped
  );

COMMIT;
NOTIFY pgrst, 'reload schema';
