import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    console.log("Applying RLS functions patch...");

    await pool.query(`
      CREATE OR REPLACE FUNCTION public.is_subscription_partner(_subscription_id uuid, _user_id uuid)
      RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
      BEGIN
          RETURN EXISTS (
              SELECT 1 FROM public.manifest_drops md
              JOIN public.manifests m ON m.id = md.manifest_id
              WHERE md.subscription_id = _subscription_id AND m.driver_id = _user_id
          );
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.is_address_partner(_address_id uuid, _user_id uuid)
      RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
      BEGIN
          RETURN EXISTS (
              SELECT 1 FROM public.manifest_drops md
              JOIN public.manifests m ON m.id = md.manifest_id
              JOIN public.subscriptions s ON s.id = md.subscription_id
              WHERE s.address_id = _address_id AND m.driver_id = _user_id
          ) OR EXISTS (
              SELECT 1 FROM public.one_time_orders
              WHERE delivery_address_id = _address_id AND delivery_partner_id = _user_id
          );
      END;
      $$;

      CREATE OR REPLACE FUNCTION public.is_profile_partner(_profile_id uuid, _user_id uuid)
      RETURNS boolean SECURITY DEFINER LANGUAGE plpgsql AS $$
      BEGIN
          RETURN EXISTS (
              SELECT 1 FROM public.manifest_drops md
              JOIN public.manifests m ON m.id = md.manifest_id
              WHERE md.user_id = _profile_id AND m.driver_id = _user_id
          ) OR EXISTS (
              SELECT 1 FROM public.one_time_orders
              WHERE user_id = _profile_id AND delivery_partner_id = _user_id
          );
      END;
      $$;
    `);

    console.log("RLS functions patch applied successfully.");
  } catch(e) {
    console.error("Error applying patch:", e);
  } finally {
    pool.end();
  }
}
run();
