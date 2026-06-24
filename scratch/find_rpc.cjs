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
    if (!data.paths) { console.log('NO PATHS', data); return; }
    
    const rpcs = Object.keys(data.paths).filter(k => k.includes('partner'));
    console.log('Available partner RPCs:');
    
    for (const rpc of rpcs) {
        let args = [];
        const params = data.paths[rpc]?.post?.parameters || [];
        const bodyParam = params.find(p => p.in === 'body');
        if (bodyParam && bodyParam.schema && bodyParam.schema.properties) {
           args = Object.keys(bodyParam.schema.properties);
        } else if (params.length) {
           args = params.map(p => p.name);
        }
        console.log(rpc, args);
    }
  } catch (err) {
    console.error(err.message);
  }
}
run();
