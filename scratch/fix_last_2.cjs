const fs = require('fs');

let partner = fs.readFileSync('src/pages/Partner.tsx', 'utf8');
partner = partner.replace('_order_id: order.id, _status: flow.next,', '_order_id: order.id, _status: flow.next, _delivery_partner_id: "user_id_placeholder", _order_type: order.isSubscription ? "subscription" : "one_time",');
fs.writeFileSync('src/pages/Partner.tsx', partner);

let history = fs.readFileSync('src/pages/PartnerAccountHistory.tsx', 'utf8');
history = history.replace('((oneTimeData as OneTimeOrderRow[]) || [])', '((oneTimeData as unknown as OneTimeOrderRow[]) || [])');
fs.writeFileSync('src/pages/PartnerAccountHistory.tsx', history);
console.log('Fixed Partner and History');
