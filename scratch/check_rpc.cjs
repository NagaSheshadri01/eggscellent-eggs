const fs = require('fs');
const path = require('path');
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, '');
});

async function run() {
  try {
    const res = await fetch(env.VITE_SUPABASE_URL + '/rest/v1/?apikey=' + env.VITE_SUPABASE_PUBLISHABLE_KEY);
    const data = await res.json();
    const rpcPath = data.paths['/rpc/partner_update_status'];
    if (rpcPath && rpcPath.post && rpcPath.post.parameters) {
      console.log('RPC Parameters:');
      rpcPath.post.parameters.forEach(p => console.log(p.name));
      console.log('JSON:', JSON.stringify(rpcPath.post.parameters, null, 2));
    } else {
      console.log('Function partner_update_status not found in OpenAPI or no params:', JSON.stringify(rpcPath, null, 2));
    }
  } catch (err) {
    console.error(err.message);
  }
}
run();
