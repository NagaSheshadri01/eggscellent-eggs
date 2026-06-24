const { Client } = require('pg');

const regions = [
  'ap-south-1', // India (Mumbai)
  'us-east-1',
  'us-west-1',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-northeast-1',
  'sa-east-1',
  'ca-central-1'
];

async function tryConnect() {
  for (const region of regions) {
    const connStr = `postgres://postgres.tdnqhyzccuspszbnvjtz:A01b02z26y25_SPB@aws-0-${region}.pooler.supabase.com:6543/postgres`;
    console.log(`Trying ${region}...`);
    const client = new Client({ connectionString: connStr, connectionTimeoutMillis: 3000 });
    try {
      await client.connect();
      console.log(`✅ Connected successfully to ${region}!`);
      
      const sql = `
        CREATE OR REPLACE FUNCTION public.partner_update_order_status(
            _order_id uuid,
            _new_status text
        )
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
            UPDATE public.one_time_orders
            SET status = _new_status::public.one_time_orders_status_enum
            WHERE id = _order_id;
        
            IF NOT FOUND THEN
                UPDATE public.subscription_deliveries
                SET status = _new_status
                WHERE id = _order_id;
            END IF;
        END;
        $$;
      `;
      await client.query(sql);
      console.log('✅ RPC Function updated successfully!');
      await client.end();
      process.exit(0);
    } catch (e) {
      console.log(`❌ Failed: ${e.message}`);
    }
  }
  console.log('Could not connect to any pooler region.');
  process.exit(1);
}

tryConnect();
