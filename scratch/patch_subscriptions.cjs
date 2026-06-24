const fs = require('fs');
let content = fs.readFileSync('src/integrations/supabase/types.ts', 'utf8');

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

const startIndex = content.indexOf('subscriptions: {');
let endIndex = content.indexOf('      }', startIndex);

content = content.replace(/subscriptions: \{[\s\S]*?Relationships: \[[\s\S]*?\]\n      \}/, subscriptionsReplacement);
if (content.includes('end_date: string | null')) {
  console.log('Regex failed, doing manual slice');
  const relIndex = content.indexOf('Relationships: [', startIndex);
  const endRel = content.indexOf(']', relIndex);
  const fullEnd = content.indexOf('}', endRel) + 1;
  content = content.substring(0, startIndex) + subscriptionsReplacement + content.substring(fullEnd);
}

fs.writeFileSync('src/integrations/supabase/types.ts', content, 'utf8');
console.log('Patched subscriptions');
