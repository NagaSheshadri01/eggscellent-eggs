import pg from 'pg';
const { Client } = pg;

const client = new Client({
  connectionString: 'postgresql://postgres:postgres@127.0.0.1:54322/postgres',
});

async function runAudit() {
  try {
    await client.connect();
    
    console.log("=========================================");
    console.log("1. CHECK WALLET SCHEMA");
    console.log("=========================================");
    const res1 = await client.query(`
      SELECT column_name, data_type, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'wallets';
    `);
    console.table(res1.rows);

    console.log("\n=========================================");
    console.log("2. IDENTIFY BLOCKING FOREIGN KEYS");
    console.log("=========================================");
    const res2 = await client.query(`
      SELECT
          tc.table_name AS dependent_table,
          tc.constraint_name,
          ccu.table_name AS target_table
      FROM information_schema.table_constraints AS tc
      JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
      WHERE constraint_type = 'FOREIGN KEY' 
      AND ccu.table_name IN (
          'subscription_items', 
          'subscription_calendar_ledger', 
          'subscription_deliveries', 
          'subscription_delivery_items', 
          'subscription_orders', 
          'subscriptions', 
          'subscription_plans'
      );
    `);
    console.table(res2.rows);

    console.log("\n=========================================");
    console.log("3. IDENTIFY HIDDEN TRIGGERS");
    console.log("=========================================");
    const res3 = await client.query(`
      SELECT trigger_name, event_object_table, action_statement
      FROM information_schema.triggers
      WHERE event_object_table LIKE 'subscription%';
    `);
    console.table(res3.rows);

  } catch (e) {
    console.error("DB Connection or Query Failed:", e.message);
  } finally {
    await client.end();
  }
}

runAudit();
