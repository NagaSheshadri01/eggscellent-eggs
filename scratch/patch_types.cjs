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
      }`;

const oneTimeOrderItemsDef = `
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
      }`;

const subscriptionItemsDef = `
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
      }`;

const subCalendarLedgerDef = `
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
      }`;

const subDeliveriesDef = `
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
      }`;

const subDeliveryItemsDef = `
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
      }`;

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
      }`;

if (!content.includes('one_time_orders: {')) {
  content = content.replace(
    'Tables: {', 
    'Tables: {' + 
    oneTimeOrdersDef + ',' + 
    oneTimeOrderItemsDef + ',' + 
    subscriptionItemsDef + ',' + 
    subCalendarLedgerDef + ',' + 
    subDeliveriesDef + ',' + 
    subDeliveryItemsDef + ','
  );
  
  content = content.replace(/subscriptions: \{[\s\S]*?Row: \{[\s\S]*?Insert: \{[\s\S]*?Update: \{[\s\S]*?Relationships: \[[\s\S]*?\]\n      \}/, subscriptionsReplacement);

  fs.writeFileSync(typesPath, content, 'utf8');
  console.log('Successfully patched types.ts');
} else {
  console.log('types.ts already contains one_time_orders');
}
