import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION assign_retail_driver(p_driver_id UUID, p_order_ids UUID[])
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        UPDATE public.one_time_orders
        SET delivery_partner_id = p_driver_id, status = 'out_for_delivery'
        WHERE id = ANY(p_order_ids);
      END;
      $$;
    `);
    console.log("SUCCESS: Created assign_retail_driver RPC");

    await pool.query(`
      CREATE OR REPLACE FUNCTION assign_manifest_driver(p_driver_id UUID, p_drop_ids UUID[], p_date DATE)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
        v_manifest_id UUID;
      BEGIN
        -- Check if a manifest already exists for this driver on this date
        SELECT id INTO v_manifest_id
        FROM public.manifests
        WHERE driver_id = p_driver_id AND delivery_date = p_date
        LIMIT 1;

        -- If not, create one
        IF v_manifest_id IS NULL THEN
          INSERT INTO public.manifests (delivery_date, driver_id, status)
          VALUES (p_date, p_driver_id, 'pending')
          RETURNING id INTO v_manifest_id;
        END IF;

        -- Reassign the drops to this manifest
        UPDATE public.manifest_drops
        SET manifest_id = v_manifest_id
        WHERE id = ANY(p_drop_ids);
      END;
      $$;
    `);
    console.log("SUCCESS: Created assign_manifest_driver RPC");
    
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("SUCCESS: Schema cache reloaded.");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
