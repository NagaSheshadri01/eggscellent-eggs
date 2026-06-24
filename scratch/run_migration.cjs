const { execSync } = require('child_process');
try {
  execSync('npx supabase db query -f supabase/migrations/20260624163047_rewrite_partner_update_order_status.sql --linked', {
    stdio: 'inherit',
    env: { ...process.env, SUPABASE_DB_PASSWORD: 'A01b02z26y25_SPB' }
  });
  console.log('Query executed successfully!');
} catch(e) {
  console.error('Execution failed:', e.message);
}
