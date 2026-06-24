const fs = require('fs');

const typesPath = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(typesPath, 'utf8');

const oneTimeOrdersDef = `
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

const subscriptionsReplacement = `subscriptions: {
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
      },`;

// Inject new tables
content = content.replace('Tables: {', 'Tables: {' + oneTimeOrdersDef);

// Find and replace subscriptions correctly
const subStartStr = '      subscriptions: {';
const startIndex = content.indexOf(subStartStr);
if (startIndex !== -1) {
  let bracesCount = 0;
  let endIndex = -1;
  let foundStartBrace = false;
  for (let i = startIndex; i < content.length; i++) {
    if (content[i] === '{') {
      bracesCount++;
      foundStartBrace = true;
    } else if (content[i] === '}') {
      bracesCount--;
    }
    
    if (foundStartBrace && bracesCount === 0) {
      endIndex = i;
      break;
    }
  }
  
  if (endIndex !== -1) {
    content = content.substring(0, startIndex) + subscriptionsReplacement + content.substring(endIndex + 1);
  }
}

fs.writeFileSync(typesPath, content, 'utf8');
console.log('Successfully patched types.ts safely');
