const fs = require('fs');
const typesPath = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(typesPath, 'utf8');

const newTables = `
      one_time_orders: {
        Row: {
          id: string
          display_id: string
          user_id: string
          delivery_address_id: string | null
          total_amount: number
          status: string
          payment_method: string
          payment_status: string
          delivery_partner_id: string | null
          delivery_slot_key: string | null
          delivery_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          display_id: string
          user_id: string
          delivery_address_id?: string | null
          total_amount: number
          status?: string
          payment_method?: string
          payment_status?: string
          delivery_partner_id?: string | null
          delivery_slot_key?: string | null
          delivery_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_id?: string
          user_id?: string
          delivery_address_id?: string | null
          total_amount?: number
          status?: string
          payment_method?: string
          payment_status?: string
          delivery_partner_id?: string | null
          delivery_slot_key?: string | null
          delivery_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_orders_delivery_address_id_fkey"
            columns: ["delivery_address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "one_time_orders_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      one_time_order_items: {
        Row: {
          id: string
          order_id: string
          product_slug: string
          quantity: number
          price: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          order_id: string
          product_slug: string
          quantity: number
          price: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          order_id?: string
          product_slug?: string
          quantity?: number
          price?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "one_time_order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "one_time_orders"
            referencedColumns: ["id"]
          }
        ]
      },
      subscription_items: {
        Row: {
          id: string
          subscription_id: string
          product_slug: string
          quantity: number
          frequency: string
          selected_days: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          subscription_id: string
          product_slug: string
          quantity: number
          frequency?: string
          selected_days?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          subscription_id?: string
          product_slug?: string
          quantity?: number
          frequency?: string
          selected_days?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_items_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "subscriptions"
            referencedColumns: ["id"]
          }
        ]
      },
      subscription_calendar_ledger: {
        Row: {
          id: string
          subscription_item_id: string
          delivery_date: string
          product_slug: string
          quantity: number
          effective_price: number
          status: string
          delivery_partner_id: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          subscription_item_id: string
          delivery_date: string
          product_slug: string
          quantity: number
          effective_price: number
          status?: string
          delivery_partner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          subscription_item_id?: string
          delivery_date?: string
          product_slug?: string
          quantity?: number
          effective_price?: number
          status?: string
          delivery_partner_id?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_calendar_ledger_subscription_item_id_fkey"
            columns: ["subscription_item_id"]
            isOneToOne: false
            referencedRelation: "subscription_items"
            referencedColumns: ["id"]
          }
        ]
      },
      subscription_deliveries: {
        Row: {
          id: string
          user_id: string
          delivery_address_id: string | null
          delivery_partner_id: string | null
          delivery_date: string
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          delivery_address_id?: string | null
          delivery_partner_id?: string | null
          delivery_date: string
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          delivery_address_id?: string | null
          delivery_partner_id?: string | null
          delivery_date?: string
          status?: string
          created_at?: string
        }
        Relationships: []
      },
      subscription_delivery_items: {
        Row: {
          id: string
          delivery_id: string
          product_slug: string
          quantity: number
          effective_price: number
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          delivery_id: string
          product_slug: string
          quantity: number
          effective_price: number
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          delivery_id?: string
          product_slug?: string
          quantity?: number
          effective_price?: number
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_delivery_items_delivery_id_fkey"
            columns: ["delivery_id"]
            isOneToOne: false
            referencedRelation: "subscription_deliveries"
            referencedColumns: ["id"]
          }
        ]
      },
      wallets: {
        Row: {
          id: string
          user_id: string
          balance: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          balance?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      },
      wallet_transactions: {
        Row: {
          id: string
          wallet_id: string
          amount: number
          transaction_type: string
          reference_id: string | null
          created_at: string
        }
        Insert: {
          id?: string
          wallet_id: string
          amount: number
          transaction_type: string
          reference_id?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          wallet_id?: string
          amount?: number
          transaction_type?: string
          reference_id?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_wallet_id_fkey"
            columns: ["wallet_id"]
            isOneToOne: false
            referencedRelation: "wallets"
            referencedColumns: ["id"]
          }
        ]
      },`;

const subsReplacement = `subscriptions: {
        Row: {
          id: string
          user_id: string
          address_id: string | null
          display_id: string
          status: string
          payment_method: string
          wallet_mode: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          address_id?: string | null
          display_id: string
          status?: string
          payment_method?: string
          wallet_mode?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          address_id?: string | null
          display_id?: string
          status?: string
          payment_method?: string
          wallet_mode?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_address_id_fkey"
            columns: ["address_id"]
            isOneToOne: false
            referencedRelation: "addresses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          }
        ]
      }`;

const funcsReplacement = `
      deduct_wallet: {
        Args: { uid: string; amount: number }
        Returns: { success: boolean; new_balance: number }
      }
      partner_update_status: {
        Args: { _order_id: string; _status: string; _delivery_partner_id: string; _order_type: string }
        Returns: void
      }
`;

// 1. Insert newTables
content = content.replace('Tables: {', 'Tables: {' + newTables);

// 2. Replace subscriptions using parsing
let startSub = content.indexOf('      subscriptions: {');
let openBraces = 0;
let endSub = -1;
let subStarted = false;
for (let i = startSub; i < content.length; i++) {
  if (content[i] === '{') {
    openBraces++;
    subStarted = true;
  } else if (content[i] === '}') {
    openBraces--;
  }
  if (subStarted && openBraces === 0) {
    endSub = i;
    break;
  }
}
content = content.substring(0, startSub) + '      ' + subsReplacement + content.substring(endSub + 1);

// 3. Fix subscription_plans using exact search & replace for CRLF or LF
const regex = /price_per_delivery\?:\s*number\s*is_active\?:\s*boolean\s*created_at\?:\s*string\s*\}\s*\}/g;
content = content.replace(regex, 'price_per_delivery?: number\n          is_active?: boolean\n          created_at?: string\n        }\n        Relationships: []\n      }');

// 4. Inject Functions properly
// The original file has Functions: {
// We insert it right after Functions: {
// If there is no deduct_wallet already
if (!content.includes('deduct_wallet: {')) {
  content = content.replace(/Functions: \{/, 'Functions: {' + funcsReplacement);
}

fs.writeFileSync(typesPath, content, 'utf8');
console.log('Perfect patch v2 applied!');
