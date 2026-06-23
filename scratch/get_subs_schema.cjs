const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(urlMatch[1], keyMatch[1]);

async function run() {
  const res = await fetch(\`\${urlMatch[1]}/rest/v1/subscriptions?limit=1\`, {
    headers: {
      apikey: keyMatch[1],
      Authorization: \`Bearer \${keyMatch[1]}\`,
      Prefer: 'return=representation'
    }
  });
  console.log('Headers:', res.headers.get('content-type'));
  
  // Or just query the DB using RPC or something.
}
run();
