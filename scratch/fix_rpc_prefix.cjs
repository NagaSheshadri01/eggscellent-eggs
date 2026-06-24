const fs = require('fs');

let types = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');
types = types.replace('p_order_id: string; p_status: string; p_delivery_partner_id: string; p_order_type: string', '_order_id: string; _status: string; _delivery_partner_id: string; _order_type: string');
fs.writeFileSync('src/integrations/supabase/types.ts', types);

let partner = fs.readFileSync('src/pages/Partner.tsx', 'utf8');
partner = partner.replace('p_order_id: order.id, p_status: flow.next, p_delivery_partner_id: order.delivery_partner_id || "", p_order_type: order.isSubscription ? "subscription" : "one_time"', '_order_id: order.id, _status: flow.next, _delivery_partner_id: order.delivery_partner_id || "", _order_type: order.isSubscription ? "subscription" : "one_time"');
fs.writeFileSync('src/pages/Partner.tsx', partner);

let sim = fs.readFileSync('src/test/runE2eSimulations.ts', 'utf8');
sim = sim.replace('p_order_id: "00000000-0000-0000-0000-000000000000",\n      p_status: "delivered",\n      p_delivery_partner_id: testUserId,\n      p_order_type: "subscription"', '_order_id: "00000000-0000-0000-0000-000000000000",\n      _status: "delivered",\n      _delivery_partner_id: testUserId,\n      _order_type: "subscription"');
fs.writeFileSync('src/test/runE2eSimulations.ts', sim);
console.log('Fixed RPC prefix to use underscores!');
