const fs = require('fs');

const path = 'src/pages/Partner.tsx';
let content = fs.readFileSync(path, 'utf8');

content = content.replace(/await supabase\.rpc\("partner_update_order_status"/g, 'await (supabase as any).rpc("partner_update_order_status"');
content = content.replace(/await \(supabase\.from\("delivery_config"\) \)\.select/g, 'await (supabase as any).from("delivery_config").select');
content = content.replace(/await supabase\.from\("one_time_orders"\)\.update/g, 'await (supabase as any).from("one_time_orders").update');
content = content.replace(/await supabase\.from\('manifest_drops'\)\.update/g, 'await (supabase as any).from("manifest_drops").update');

fs.writeFileSync(path, content, 'utf8');
console.log('Partner patched 2');
