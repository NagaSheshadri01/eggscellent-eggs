const fs = require('fs');

const path = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add selected_days and paused_dates to subscriptions
content = content.replace(
  /subscriptions: \{\s+Row: \{([\s\S]*?)\}\s+Insert: \{([\s\S]*?)\}\s+Update: \{([\s\S]*?)\}\s+Relationships: \[([\s\S]*?)\]\s+\}/g,
  (match, row, insert, update, rels) => {
    if (!row.includes('paused_dates')) {
      row = row.replace(/status: string/, 'status: string\n          selected_days: string[] | null\n          paused_dates: string[] | null');
      insert = insert.replace(/status\?: string/, 'status?: string\n          selected_days?: string[] | null\n          paused_dates?: string[] | null');
      update = update.replace(/status\?: string/, 'status?: string\n          selected_days?: string[] | null\n          paused_dates?: string[] | null');
    }
    return `subscriptions: {\n        Row: {${row}}\n        Insert: {${insert}}\n        Update: {${update}}\n        Relationships: [${rels}]\n      }`;
  }
);

// 2. Add manifests and manifest_drops to Tables
const manifestsTable = `
      manifests: {
        Row: {
          id: string
          delivery_date: string | null
          driver_id: string | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          delivery_date?: string | null
          driver_id?: string | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          delivery_date?: string | null
          driver_id?: string | null
          status?: string | null
          created_at?: string
        }
        Relationships: []
      }`;

const manifestDropsTable = `
      manifest_drops: {
        Row: {
          id: string
          manifest_id: string | null
          subscription_id: string | null
          user_id: string | null
          product_slug: string | null
          quantity: number | null
          escrow_amount: number | null
          status: string | null
          created_at: string
        }
        Insert: {
          id?: string
          manifest_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
          product_slug?: string | null
          quantity?: number | null
          escrow_amount?: number | null
          status?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          manifest_id?: string | null
          subscription_id?: string | null
          user_id?: string | null
          product_slug?: string | null
          quantity?: number | null
          escrow_amount?: number | null
          status?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "manifest_drops_manifest_id_fkey"
            columns: ["manifest_id"]
            isOneToOne: false
            referencedRelation: "manifests"
            referencedColumns: ["id"]
          }
        ]
      }`;

if (!content.includes('manifests: {')) {
  content = content.replace(/Tables: \{/, `Tables: {${manifestsTable}${manifestDropsTable}`);
}

// 3. Delete legacy tables
const tablesToRemove = [
  'subscription_calendar_ledger',
  'subscription_deliveries',
  'subscription_delivery_items',
  'subscription_items',
  'subscription_orders'
];

for (const table of tablesToRemove) {
  const regex = new RegExp(`\\s+${table}: \\{[\\s\\S]*?Relationships: \\[[\\s\\S]*?\\]\\n\\s+\\}`, 'g');
  content = content.replace(regex, '');
}

// 4. Delete relationships pointing to those tables
// Wait, the TypeScript compiler will complain if any existing relations point to dropped tables. Let's just strip lines with referencedRelation: "dropped_table"
for (const table of tablesToRemove) {
  const regex = new RegExp(`\\{[\\s]*foreignKeyName: "[^"]+"[\\s]*columns: \\[[^]]+\\][\\s]*isOneToOne: (true|false)[\\s]*referencedRelation: "${table}"[\\s]*referencedColumns: \\[[^]]+\\][\\s]*\\},?`, 'g');
  content = content.replace(regex, '');
}

fs.writeFileSync(path, content);
console.log('types.ts patched.');
