const fs = require('fs');

let content = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');

// Inject delivery_partner_id into one_time_orders
content = content.replace(/delivery_date: string \| null/g, 'delivery_partner_id: string | null\n          delivery_date: string | null');
content = content.replace(/delivery_date\?: string \| null/g, 'delivery_partner_id?: string | null\n          delivery_date?: string | null');

// Inject deduct_wallet and partner_update_status into Functions
const newFunctions = `
      deduct_wallet: {
        Args: { uid: string; amount: number }
        Returns: { success: boolean; new_balance: number }
      }
      partner_update_status: {
        Args: { _order_id: string; _status: string; _delivery_partner_id: string; _order_type: string }
        Returns: void
      }
`;

content = content.replace(/Functions: \{/, 'Functions: {' + newFunctions);

fs.writeFileSync('src/integrations/supabase/types.ts', content);
console.log('Injected missing fields and functions');
