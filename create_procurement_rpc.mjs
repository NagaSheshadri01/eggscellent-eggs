import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await pool.query(`
      CREATE OR REPLACE FUNCTION get_procurement_totals(p_date DATE)
      RETURNS TABLE (
        product_id UUID,
        product_name TEXT,
        master_quantity_required BIGINT
      ) AS $$
      BEGIN
        RETURN QUERY
        WITH base_subs AS (
          SELECT 
            p.id AS product_id,
            p.name AS product_name,
            SUM(s.quantity) AS base_qty
          FROM subscriptions s
          JOIN products p ON p.slug = s.product_slug
          WHERE s.status = 'active'
            AND (EXTRACT(DOW FROM p_date)::int)::text = ANY(s.selected_days)
          GROUP BY p.id, p.name
        ),
        override_add AS (
          SELECT 
            o.product_id,
            SUM(o.quantity) AS add_qty
          FROM subscription_calendar_overrides o
          WHERE o.override_date = p_date
            AND o.operation = 'ADD'
          GROUP BY o.product_id
        ),
        override_remove AS (
          SELECT 
            o.product_id,
            SUM(s.quantity) AS remove_qty
          FROM subscription_calendar_overrides o
          JOIN subscriptions s ON s.id = o.subscription_id
          WHERE o.override_date = p_date
            AND o.operation = 'REMOVE'
          GROUP BY o.product_id
        ),
        override_update AS (
          SELECT 
            o.product_id,
            SUM(o.quantity - s.quantity) AS update_qty
          FROM subscription_calendar_overrides o
          JOIN subscriptions s ON s.id = o.subscription_id
          WHERE o.override_date = p_date
            AND o.operation = 'UPDATE_QUANTITY'
          GROUP BY o.product_id
        ),
        all_products AS (
          SELECT product_id, product_name FROM base_subs
          UNION
          SELECT p.id, p.name 
          FROM (
            SELECT product_id FROM override_add
            UNION SELECT product_id FROM override_remove
            UNION SELECT product_id FROM override_update
          ) as o_prods
          JOIN products p ON p.id = o_prods.product_id
        )
        SELECT 
          ap.product_id,
          ap.product_name,
          COALESCE(bs.base_qty, 0) + COALESCE(oa.add_qty, 0) - COALESCE(or_rm.remove_qty, 0) + COALESCE(ou.update_qty, 0) AS master_quantity_required
        FROM all_products ap
        LEFT JOIN base_subs bs ON bs.product_id = ap.product_id
        LEFT JOIN override_add oa ON oa.product_id = ap.product_id
        LEFT JOIN override_remove or_rm ON or_rm.product_id = ap.product_id
        LEFT JOIN override_update ou ON ou.product_id = ap.product_id
        WHERE (COALESCE(bs.base_qty, 0) + COALESCE(oa.add_qty, 0) - COALESCE(or_rm.remove_qty, 0) + COALESCE(ou.update_qty, 0)) > 0;
      END;
      $$ LANGUAGE plpgsql SECURITY DEFINER;
    `);
    console.log("RPC created successfully.");
  } catch (error) {
    console.error("ERROR:", error.message);
  } finally {
    pool.end();
  }
}
run();
