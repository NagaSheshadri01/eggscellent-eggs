import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  const res = await pool.query(`
    SELECT
      tc.table_schema, 
      tc.constraint_name, 
      tc.table_name, 
      kcu.column_name, 
      ccu.table_schema AS foreign_table_schema,
      ccu.table_name AS foreign_table_name,
      ccu.column_name AS foreign_column_name 
    FROM 
      information_schema.table_constraints AS tc 
      JOIN information_schema.key_column_usage AS kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage AS ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='manifest_drops';
  `);
  console.log(res.rows);
  
  // also apply phase 2 sql
  console.log('Applying Phase 2 SQL...');
  await pool.query(`
    CREATE OR REPLACE FUNCTION public.toggle_drop_stock_status(p_drop_id uuid, p_is_out_of_stock boolean)
    RETURNS void
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
        v_drop record;
        v_refund_amount numeric;
    BEGIN
        -- Lock and get drop details
        SELECT * INTO v_drop FROM public.manifest_drops WHERE id = p_drop_id FOR UPDATE;
        IF NOT FOUND THEN RAISE EXCEPTION 'Drop not found'; END IF;

        -- The amount previously deducted
        v_refund_amount := v_drop.escrow_amount; 

        IF p_is_out_of_stock THEN
            -- Mark as out of stock, refund the user's main wallet
            UPDATE public.manifest_drops SET status = 'out_of_stock' WHERE id = p_drop_id;
            UPDATE public.profiles SET balance = COALESCE(balance, 0) + v_refund_amount WHERE id = v_drop.user_id;
        ELSE
            -- Restore stock, deduct from wallet again
            UPDATE public.manifest_drops SET status = 'pending' WHERE id = p_drop_id;
            UPDATE public.profiles SET balance = COALESCE(balance, 0) - v_refund_amount WHERE id = v_drop.user_id;
        END IF;
    END;
    $$;
  `);
  console.log('Phase 2 SQL applied successfully!');
  pool.end();
}
run();
