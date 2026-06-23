const fs = require('fs');
const path = 'scratch/AccountSubscriptions.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update Types
code = code.replace(/type SubscriptionContract = \{[\s\S]*?^  products\?: \{\n    name: string;\n  \} \| null;\n\};/m, `type SubscriptionContract = {
  id: string;
  user_id: string;
  status: string;
  delivery_address_id: string | null;
  created_at: string;
  subscription_items: Array<{
    id: string;
    product_slug: string;
    quantity: number;
    frequency: string;
    selected_days: number[];
    products: {
      name: string;
      discounted_price: number | null;
      original_price: number | null;
      image_url: string | null;
    } | null;
  }>;
  addresses?: {
    address_line_1: string;
    address_line_2: string | null;
    landmark: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
  } | null;
};`);

// Update Query
code = code.replace(/queryFn: async \(\) => \{\s*if \(\!user\) return \[\];\s*const \{ data, error \} = await supabase\s*\.from\("subscriptions"\)\s*\.select\(\`\s*\*\,\s*products:product_id \(name\, discounted_price\, image_url\)\,\s*subscription_plans:plan_id \(\*\)\,\s*addresses:address_id \(address_line_1\, address_line_2\, landmark\, city\, state\, pincode\)\s*\`\)\s*\.eq\("user_id"\, user\.id\)/m, 
`queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("subscriptions")
        .select(\`
          *,
          subscription_items (
            id,
            product_slug,
            quantity,
            frequency,
            selected_days,
            products:product_slug (name, discounted_price, image_url)
          ),
          addresses:delivery_address_id (address_line_1, address_line_2, landmark, city, state, pincode)
        \`)
        .eq("user_id", user.id)`);

fs.writeFileSync(path, code);
console.log('AccountSubscriptions.tsx query rewritten.');
