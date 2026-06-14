import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && val) {
    envVars[key.trim()] = val.join('=').trim().replace(/^"/, '').replace(/"$/, '');
  }
});

const supabaseUrl = envVars.VITE_SUPABASE_URL;
const supabaseKey = envVars.VITE_SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  console.log('Fetching ledger...');
  const { data: ledgers, error: ledErr } = await supabase.from('delivery_ledger').select('id, delivery_partner_id').limit(1);
  if (ledErr) {
    console.error('Ledger fetch error:', ledErr);
    return;
  }
  if (!ledgers || ledgers.length === 0) {
    console.log('No ledgers found');
    return;
  }
  const ledgerId = ledgers[0].id;
  
  console.log('Fetching a delivery partner...');
  const { data: partners, error: partErr } = await supabase.from('delivery_partners').select('id, user_id, full_name').eq('status', 'approved').limit(1);
  if (partErr) {
    console.error('Partner fetch error:', partErr);
    return;
  }
  if (!partners || partners.length === 0) {
    console.log('No partners found');
    return;
  }
  const partner = partners[0];
  console.log('Using partner:', partner);

  console.log('Attempting to update ledger with user_id:', partner.user_id);
  const { data: upd1, error: err1 } = await supabase.from('delivery_ledger').update({ delivery_partner_id: partner.user_id }).eq('id', ledgerId);
  console.log('Result with user_id:', err1 ? err1.message : 'Success');

  console.log('Attempting to update ledger with partner.id:', partner.id);
  const { data: upd2, error: err2 } = await supabase.from('delivery_ledger').update({ delivery_partner_id: partner.id }).eq('id', ledgerId);
  console.log('Result with partner.id:', err2 ? err2.message : 'Success');
}

test();
