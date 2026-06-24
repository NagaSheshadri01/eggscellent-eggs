const fs = require('fs');

let types = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');
types = types.replace(/partner_update_status: \{\s*Args: \{ _order_id: string; _status: string; _delivery_partner_id: string; _order_type: string \}\s*Returns: void\s*\}/, 'partner_update_order_status: { Args: { _new_status: string; _order_id: string }; Returns: undefined }');
fs.writeFileSync('src/integrations/supabase/types.ts', types);

let partner = fs.readFileSync('src/pages/Partner.tsx', 'utf8');
partner = partner.replace(/await supabase\.rpc\(\"partner_update_status\", \{\s*_order_id: order\.id, _status: flow\.next, _delivery_partner_id: order\.delivery_partner_id \|\| \"\", _order_type: order\.isSubscription \? \"subscription\" : \"one_time\",\s*\}\);/, 'await supabase.rpc("partner_update_order_status", { _order_id: order.id, _new_status: flow.next });');
fs.writeFileSync('src/pages/Partner.tsx', partner);

let sim = fs.readFileSync('src/test/runE2eSimulations.ts', 'utf8');
sim = sim.replace(/await supabase\.rpc\(\"partner_update_status\", \{\s*_order_id: \"00000000-0000-0000-0000-000000000000\",\s*_status: \"delivered\",\s*_delivery_partner_id: testUserId,\s*_order_type: \"subscription\"\s*\}\);/, 'await supabase.rpc("partner_update_order_status", { _order_id: "00000000-0000-0000-0000-000000000000", _new_status: "delivered" });');
fs.writeFileSync('src/test/runE2eSimulations.ts', sim);
console.log('Fixed true RPC signature natively!');
