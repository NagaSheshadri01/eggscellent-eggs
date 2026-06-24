-- Ensure delivery_ledger is in the supabase_realtime publication
-- so that Postgres changes (UPDATE events) are broadcast to connected clients.
-- This enables the user-side SubscriptionCalendar to instantly reflect
-- admin status changes (Out of Stock / Restore Stock) without a page reload.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'delivery_ledger'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_ledger;
    RAISE NOTICE 'Added delivery_ledger to supabase_realtime';
  ELSE
    RAISE NOTICE 'delivery_ledger already in supabase_realtime — no change needed';
  END IF;
END $$;
