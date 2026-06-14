import { Client } from 'pg';

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function run() {
  await client.connect();
  console.log('Connected to pg');
  
  // Check foreign keys on orders
  const res = await client.query(`
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
    WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_name='orders';
  `);
  console.log('Foreign keys on orders:');
  console.table(res.rows);

  await client.end();
}

run().catch(console.error);
