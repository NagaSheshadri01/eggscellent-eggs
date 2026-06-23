const fs = require('fs');
const path = 'scratch/AdminOrders.tsx';
let code = fs.readFileSync(path, 'utf8');

// 1. Update query columns
code = code.replace(
`.from("orders")
        .select(\`
          *,
          addresses(pincode, lat, lng),
          order_items(product_name, product_id)
        \` as any)`,
`.from("one_time_orders")
        .select(\`
          id,
          display_id,
          delivery_date,
          total_amount,
          status,
          created_at,
          delivery_partner_id,
          delivery_slots,
          user_id,
          payment_status,
          addresses:delivery_address_id(pincode, lat, lng),
          one_time_order_items(*)
        \` as any)`);

// 2. Real-time subscription
code = code.replace(
`{ event: "INSERT", schema: "public", table: "orders" },`,
`{ event: "INSERT", schema: "public", table: "one_time_orders" },`
);

// 3. Update orders update (single update)
code = code.replace(
`.from("orders").update({ order_status: status as any })`,
`.from("one_time_orders").update({ status: status as any })`
);

// 4. Update orders bulk update (bulkAssign)
code = code.replace(
`.from("orders")
      .update({
        delivery_partner_id: targetPartner,
        order_status: "confirmed" as any
      })`,
`.from("one_time_orders")
      .update({
        delivery_partner_id: targetPartner,
        status: "confirmed" as any
      })`
);

code = code.replace(
`const PENDING = ["placed", "confirmed", "out_for_delivery"];`,
`const PENDING = ["placed", "pending", "confirmed", "out_for_delivery"];`
);

// 5. Update UI properties
code = code.replace(/o\.order_status/g, 'o.status');
code = code.replace(/o\.total/g, 'o.total_amount');
code = code.replace(/o\.custom_order_id/g, 'o.display_id');
code = code.replace(/o\.order_items/g, 'o.one_time_order_items');
code = code.replace(/item\.product_name/g, '(item.product_name || item.product_slug)');

fs.writeFileSync(path, code);
console.log('AdminOrders.tsx rewritten');
