const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://postgres.tdnqhyzccuspszbnvjtz:A01b02z26y25_SPB@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
});

async function run() {
  await client.connect();
  const userId = '36111753-c89f-41f1-8f15-713be4c340ed';
  
  // Create user in auth.users
  await client.query(`
    INSERT INTO auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
    VALUES ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', 'fallback@test.com', 'foo', now(), now(), now(), '{}', '{}', now(), now(), '', '', '', '')
    ON CONFLICT (id) DO NOTHING;
  `, [userId]);
  
  console.log('Inserted into auth.users');
  await client.end();
}

run().catch(console.error);
