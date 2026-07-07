const { Client } = require('pg');
const client = new Client({ connectionString: 'postgresql://postgres:A01b02z26y25_SPB@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres' });
client.connect().then(async () => {
  console.log('Connected!');
  
  // Check RLS policies for one_time_orders
  const res = await client.query(`
    SELECT pol.polname, pol.polqual, pol.polwithcheck, cls.relname 
    FROM pg_policy pol 
    JOIN pg_class cls ON pol.polrelid = cls.oid 
    WHERE cls.relname IN ('one_time_orders', 'addresses');
  `);
  console.log(res.rows);
  
  client.end();
}).catch(console.error);
