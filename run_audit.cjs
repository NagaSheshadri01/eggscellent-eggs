const { Client } = require('pg');

const dbUrl = 'postgresql://postgres.tdnqhyzccuspszbnvjtz:A01b02z26y25_SPB@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const client = new Client({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false }
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
