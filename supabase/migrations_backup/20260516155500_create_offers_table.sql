-- Create the dedicated offers table
CREATE TABLE IF NOT EXISTS public.offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,               -- e.g., 'Free Delivery Special'
  description TEXT NOT NULL,         -- e.g., 'Add items worth ₹300 to unlock free shipping'
  min_order_value NUMERIC(10,2) NOT NULL DEFAULT 0.00,
  coupon_code_to_apply TEXT NOT NULL, -- The specific coupon string (e.g., 'FREESHIP')
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS and set policies
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;

-- Policy for Admins
DO $$ BEGIN
  CREATE POLICY "Admins manage offers" ON public.offers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Policy for Public
DO $$ BEGIN
  CREATE POLICY "Public view active offers" ON public.offers FOR SELECT TO anon, authenticated USING (is_active = true);
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Refresh schema cache
NOTIFY pgrst, 'reload schema';
