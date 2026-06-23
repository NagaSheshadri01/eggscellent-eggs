const fs = require('fs');

const path = 'scratch/AdminLogistics.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update the DeliveryStop interface
code = code.replace(/interface DeliveryStop \{[\s\S]*?\n\}/, `interface DeliveryStop {
  userId: string;
  customerInfo: any;
  address: any;
  assignedDriverId: string | null;
  items: Array<{
    id: string;
    product_slug: string;
    quantity: number;
    price: number;
    status: string;
    sourceType: 'subscription' | 'one_time';
  }>;
  netQuantity: number;
  deliveryIds: string[];
  oneTimeIds: string[];
}`);

// 2. Update item status mutation
code = code.replace(/const updateItemStatusMutation = useMutation\(\{[\s\S]*?onSuccess: \(\) => \{/m, `const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, sourceType, newStatus }: { itemId: string; sourceType: 'subscription' | 'one_time'; newStatus: string }) => {
      const table = sourceType === 'subscription' ? 'subscription_delivery_items' : 'one_time_order_items';
      const { error } = await (supabase as any)
        .from(table)
        .update({ status: newStatus })
        .eq('id', itemId);
      if (error) throw error;
    },
    onSuccess: () => {`);

// 3. Update queryFn for todayDispatchQ
const newQueryFn = `queryFn: async () => {
      const targetDate = todayStr;
      
      const { data: subDeliveries, error: subErr } = await (supabase as any)
        .from("subscription_deliveries")
        .select(\`
          *,
          profiles:user_id (id, full_name, phone, email),
          subscription_delivery_items (*),
          addresses:delivery_address_id (*)
        \`)
        .eq("delivery_date", targetDate);
      if (subErr) throw subErr;

      const { data: retailDeliveries, error: retailErr } = await (supabase as any)
        .from("one_time_orders")
        .select(\`
          *,
          profiles:user_id (id, full_name, phone, email),
          one_time_order_items (*),
          addresses:delivery_address_id (*)
        \`)
        .eq("delivery_date", targetDate);
      if (retailErr) throw retailErr;

      const mergedMap = new Map();
      const processAddress = (o: any) => o.addresses || { city: '', address_line_1: '', pincode: o.pincode || '' };

      (subDeliveries || []).forEach((d: any) => {
        const mappedItems = (d.subscription_delivery_items || []).map((item: any) => ({
          id: item.id,
          product_slug: item.product_slug,
          quantity: item.quantity,
          price: item.effective_price,
          status: item.status || 'pending',
          sourceType: 'subscription'
        }));
        mergedMap.set(d.user_id, {
          userId: d.user_id,
          customerInfo: d.profiles,
          address: processAddress(d),
          assignedDriverId: d.delivery_partner_id,
          items: mappedItems,
          netQuantity: mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
          deliveryIds: [d.id],
          oneTimeIds: []
        });
      });

      (retailDeliveries || []).forEach((o: any) => {
        const mappedItems = (o.one_time_order_items || []).map((item: any) => ({
          id: item.id,
          product_slug: item.product_slug,
          quantity: item.quantity,
          price: item.price,
          status: item.status || 'pending',
          sourceType: 'one_time'
        }));
        if (mergedMap.has(o.user_id)) {
           const existing = mergedMap.get(o.user_id);
           existing.items.push(...mappedItems);
           existing.netQuantity += mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0);
           existing.oneTimeIds.push(o.id);
        } else {
           mergedMap.set(o.user_id, {
             userId: o.user_id,
             customerInfo: o.profiles,
             address: processAddress(o),
             assignedDriverId: o.delivery_partner_id,
             items: mappedItems,
             netQuantity: mappedItems.reduce((acc: number, i: any) => acc + i.quantity, 0),
             deliveryIds: [],
             oneTimeIds: [o.id]
           });
        }
      });
      return Array.from(mergedMap.values()) as DeliveryStop[];
    }`;

code = code.replace(/queryFn: async \(\) => \{[\s\S]*?return Array\.from\(mergedMap\.values\(\)\);\n    \}/, newQueryFn);

// 4. Update queryFn for tomorrowDispatchQ
const newTomorrowFn = newQueryFn.replace('const targetDate = todayStr;', 'const targetDate = tomorrowStr;');
code = code.replace(/queryFn: async \(\) => \{[\s\S]*?return Array\.from\(mergedMap\.values\(\)\);\n    \}/, newTomorrowFn);

fs.writeFileSync(path, code);
console.log('AdminLogistics.tsx prepped for bulk assign & UI changes.');
