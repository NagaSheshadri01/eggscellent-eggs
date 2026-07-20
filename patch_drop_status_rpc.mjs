import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION partner_update_drop_status(p_drop_id UUID, p_new_status TEXT)
      RETURNS void AS $$
      DECLARE
        v_user_id UUID;
        v_escrow NUMERIC;
        v_current_status TEXT;
      BEGIN
        SELECT user_id, escrow_amount, status INTO v_user_id, v_escrow, v_current_status
        FROM public.manifest_drops
        WHERE id = p_drop_id FOR UPDATE;
        
        IF v_current_status = p_new_status THEN
          RETURN;
        END IF;

        IF v_current_status = 'delivered' THEN
          RAISE EXCEPTION 'Drop is already delivered and cannot be modified.';
        END IF;

        UPDATE public.manifest_drops
        SET status = p_new_status
        WHERE id = p_drop_id;

        IF p_new_status = 'delivered' AND COALESCE(v_escrow, 0) > 0 THEN
          -- Deduct the wallet which creates a ledger entry
          PERFORM deduct_wallet(v_user_id, v_escrow);
        END IF;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log("SUCCESS: Created partner_update_drop_status RPC");
    
    await pool.query(`NOTIFY pgrst, 'reload schema';`);
    console.log("SUCCESS: Schema cache reloaded.");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
