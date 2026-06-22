import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: `postgresql://postgres.tdnqhyzccuspszbnvjtz:${encodeURIComponent('A01b02z26y25_SPB')}@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres`,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT 
        t.table_name,
        c.column_name,
        c.data_type,
        c.is_nullable,
        c.column_default
      FROM information_schema.tables t
      JOIN information_schema.columns c ON t.table_name = c.table_name
      WHERE t.table_schema = 'public'
      ORDER BY t.table_name, c.ordinal_position;
    `);

    const constraints = await pool.query(`
      SELECT 
        conrelid::regclass AS table_name,
        conname AS constraint_name,
        pg_get_constraintdef(oid) AS definition
      FROM pg_constraint
      WHERE contype IN ('f', 'p', 'c', 'u')
      AND connamespace = 'public'::regnamespace;
    `);

    const indexes = await pool.query(`
      SELECT 
        tablename,
        indexname,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public';
    `);

    const fs = await import('fs');
    fs.writeFileSync('scratch/schema_dump.json', JSON.stringify({
      columns: res.rows,
      constraints: constraints.rows,
      indexes: indexes.rows
    }, null, 2));

    console.log("Schema dumped successfully!");
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
