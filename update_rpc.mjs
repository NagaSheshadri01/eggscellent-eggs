import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    // Drop all signatures of deduct_wallet
    await pool.query(`DROP FUNCTION IF EXISTS public.deduct_wallet(uuid, numeric);`);
    await pool.query(`DROP FUNCTION IF EXISTS public.deduct_wallet(uid uuid, amount numeric);`);

    await pool.query(`
      CREATE OR REPLACE FUNCTION public.deduct_wallet(uid uuid, amount numeric)
      RETURNS boolean
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      DECLARE
          current_balance numeric;
          target_wallet_id uuid;
      BEGIN
          -- Lock the wallet row to prevent race conditions
          SELECT balance, id INTO current_balance, target_wallet_id FROM public.wallets WHERE user_id = uid FOR UPDATE;
          
          IF target_wallet_id IS NULL THEN
              RAISE EXCEPTION 'Wallet not found';
          END IF;

          IF current_balance >= amount THEN
              -- Explicitly deduct the balance
              UPDATE public.wallets SET balance = balance - amount WHERE user_id = uid;
              
              -- Log the transaction
              INSERT INTO public.wallet_transactions (wallet_id, amount, transaction_type, reference_id)
              VALUES (target_wallet_id, amount, 'delivery_deduction', 'Order Payment Deducted');
              
              RETURN true;
          ELSE
              RAISE EXCEPTION 'Insufficient wallet balance';
          END IF;
      END;
      $$;
    `);
    console.log("SUCCESS: RPC deduct_wallet updated successfully.");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
