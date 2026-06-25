const { execSync } = require('child_process');
try {
  execSync('npx supabase db query "SELECT routine_definition FROM information_schema.routines WHERE routine_name = \'deduct_wallet\';" --db-url "postgresql://postgres:A01b02z26y25_SPB@db.tdnqhyzccuspszbnvjtz.supabase.co:5432/postgres"', {
    stdio: 'inherit',
  });
} catch(e) {
  console.error('Execution failed:', e.message);
}
