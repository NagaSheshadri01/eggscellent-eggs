import { createClient } from '@supabase/supabase-js';
const supabase = createClient(
  'https://tdnqhyzccuspszbnvjtz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkbnFoeXpjY3VzcHN6Ym52anR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjEzOTEsImV4cCI6MjA5NDIzNzM5MX0.kB8UZAN0sgmQC2lQk6m9Vu_RRA27WeuzuzRd_Oowt8A'
);

async function test() {
  const { data, error } = await supabase.rpc('calculate_order_delivery_fee', { p_address_id: '1d9d4770-a70b-4f2a-8d0c-06db49eab01d' }); // Dummy UUID
  console.log('Result:', data, 'Error:', error);
}
test();
