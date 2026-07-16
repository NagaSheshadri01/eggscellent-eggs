import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION toggle_retail_stock_status(p_item_id UUID, p_is_out_of_stock BOOLEAN)
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        UPDATE public.one_time_order_items
        SET status = CASE WHEN p_is_out_of_stock THEN 'out_of_stock' ELSE 'pending' END
        WHERE id = p_item_id;
      END;
      $$;
    `);
    console.log("SUCCESS: Created toggle_retail_stock_status RPC");
    
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("SUCCESS: Schema cache reloaded.");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
