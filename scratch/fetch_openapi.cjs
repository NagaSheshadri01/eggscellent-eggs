const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const urlMatch = env.match(/VITE_SUPABASE_URL="(.*)"/);
const keyMatch = env.match(/VITE_SUPABASE_PUBLISHABLE_KEY="(.*)"/);

async function run() {
  const url = urlMatch[1] + '/rest/v1/?apikey=' + keyMatch[1];
  const res = await fetch(url);
  const json = await res.json();
  fs.writeFileSync('scratch/openapi.json', JSON.stringify(json, null, 2));
}
run();
