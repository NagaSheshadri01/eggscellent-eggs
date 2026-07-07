const fs = require('fs');

const path = 'src/integrations/supabase/types.ts';
let content = fs.readFileSync(path, 'utf8');

// 1. Add address_id to subscriptions Insert/Update/Row
content = content.replace(
  /price_per_unit: number \| null\n(\s+)product_slug: string \| null/g,
  "price_per_unit: number | null\n$1product_slug: string | null\n$1address_id: string | null"
);

content = content.replace(
  /price_per_unit\?: number \| null\n(\s+)product_slug\?: string \| null/g,
  "price_per_unit?: number | null\n$1product_slug?: string | null\n$1address_id?: string | null"
);

// 2. Add address_id to manifest_drops Insert/Update/Row
content = content.replace(
  /quantity: number \| null\n(\s+)status: string \| null/g,
  "quantity: number | null\n$1status: string | null\n$1address_id: string | null"
);

content = content.replace(
  /quantity\?: number \| null\n(\s+)status\?: string \| null/g,
  "quantity?: number | null\n$1status?: string | null\n$1address_id?: string | null"
);

// Also add to relationships for subscriptions
if (!content.includes('foreignKeyName: "subscriptions_address_id_fkey"')) {
  content = content.replace(
    /Relationships: \[\n\s*{\n\s*foreignKeyName: "subscriptions_user_id_fkey"/,
    `Relationships: [
            {
              foreignKeyName: "subscriptions_address_id_fkey"
              columns: ["address_id"]
              isOneToOne: false
              referencedRelation: "addresses"
              referencedColumns: ["id"]
            },
            {
              foreignKeyName: "subscriptions_user_id_fkey"`
  );
}

// Also add to relationships for manifest_drops
if (!content.includes('foreignKeyName: "manifest_drops_address_id_fkey"')) {
  content = content.replace(
    /Relationships: \[\n\s*{\n\s*foreignKeyName: "manifest_drops_manifest_id_fkey"/,
    `Relationships: [
            {
              foreignKeyName: "manifest_drops_address_id_fkey"
              columns: ["address_id"]
              isOneToOne: false
              referencedRelation: "addresses"
              referencedColumns: ["id"]
            },
            {
              foreignKeyName: "manifest_drops_manifest_id_fkey"`
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log("Updated types.ts");
