const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const env = fs.readFileSync('.env', 'utf8');
const url = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_URL=')).split('=')[1].trim().replace(/"/g, '');
const key = env.split('\n').find(line => line.startsWith('VITE_SUPABASE_PUBLISHABLE_KEY=')).split('=')[1].trim().replace(/"/g, '');
const supabase = createClient(url, key);

const sql = `
DROP POLICY IF EXISTS "Users can insert their own calendar delivery entries" ON public.delivery_ledger;
CREATE POLICY "Users can insert their own calendar delivery entries" ON public.delivery_ledger
  FOR INSERT 
  TO authenticated 
  WITH CHECK (
    subscription_id IN (
      SELECT id FROM public.subscriptions WHERE user_id = auth.uid()
    )
    AND status IN ('scheduled', 'pending_payment', 'skipped')
  );
`;

supabase.rpc('run_sql', { query: sql })
  .then(res => console.log('Success:', res))
  .catch(err => console.error('Error:', err));
