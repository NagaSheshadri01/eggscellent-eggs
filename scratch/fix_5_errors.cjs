const fs = require('fs');

// Fix 1: Checkout.tsx
let checkout = fs.readFileSync('src/pages/Checkout.tsx', 'utf8');
checkout = checkout.replace('setPayment(v )', 'setPayment(v as "upi" | "cod" | "online" | "wallet")');
fs.writeFileSync('src/pages/Checkout.tsx', checkout);

// Fix 2: Partner.tsx
let partner = fs.readFileSync('src/pages/Partner.tsx', 'utf8');
partner = partner.replace('_new_status: flow.next', '_status: flow.next');
fs.writeFileSync('src/pages/Partner.tsx', partner);

// Fix 3: PartnerAccountHistory.tsx
let history = fs.readFileSync('src/pages/PartnerAccountHistory.tsx', 'utf8');
if (!history.includes("import { Database }")) {
  history = "import { Database } from '@/integrations/supabase/types';\n" + history;
}
if (!history.includes("type OneTimeOrderRow =")) {
  history = history.replace("const PartnerAccountHistory = () => {", "type OneTimeOrderRow = Database['public']['Tables']['one_time_orders']['Row'];\n\nconst PartnerAccountHistory = () => {");
}
history = history.replace('...(oneTimeData || []).map(o => ({', '...((oneTimeData as OneTimeOrderRow[]) || []).map(o => ({');
fs.writeFileSync('src/pages/PartnerAccountHistory.tsx', history);

console.log('Fixed 5 errors');
