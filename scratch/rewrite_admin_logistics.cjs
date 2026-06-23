const fs = require('fs');
const path = 'scratch/AdminLogistics.tsx';
let code = fs.readFileSync(path, 'utf8');

const targetStr = `      const { data: subDeliveries, error: subErr } = await (supabase as any)
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
      if (retailErr) throw retailErr;`;

const replacementStr = `      let subDeliveries = [];
      try {
        const { data: subData, error: subErr } = await (supabase as any)
          .from("subscription_deliveries")
          .select(\`
            *,
            profiles:user_id (id, full_name, phone, email),
            subscription_delivery_items (*),
            addresses:delivery_address_id (*)
          \`)
          .eq("delivery_date", targetDate);
        if (subErr) throw subErr;
        subDeliveries = subData || [];
      } catch (err: any) {
        console.error("Subscription Pipeline Error:", err);
        toast.error("Failed to fetch subscription items: " + err.message);
      }

      let retailDeliveries = [];
      try {
        const { data: retailData, error: retailErr } = await (supabase as any)
          .from("one_time_orders")
          .select(\`
            *,
            profiles:user_id (id, full_name, phone, email),
            one_time_order_items (*),
            addresses:delivery_address_id (*)
          \`)
          .eq("delivery_date", targetDate);
        if (retailErr) throw retailErr;
        retailDeliveries = retailData || [];
      } catch (err: any) {
        console.error("Retail Pipeline Error:", err);
        toast.error("Failed to fetch retail items: " + err.message);
      }`;

code = code.replace(targetStr, replacementStr);

const tomorrowTargetStr = `      const { data: subDeliveries, error: subErr } = await (supabase as any)
        .from("subscription_deliveries")
        .select(\`
          *,
          profiles:user_id (id, full_name, phone, email),
          subscription_delivery_items (*),
          addresses:delivery_address_id (*)
        \`)
        .eq("delivery_date", tomorrowStr);
      if (subErr) throw subErr;

      const { data: retailDeliveries, error: retailErr } = await (supabase as any)
        .from("one_time_orders")
        .select(\`
          *,
          profiles:user_id (id, full_name, phone, email),
          one_time_order_items (*),
          addresses:delivery_address_id (*)
        \`)
        .eq("delivery_date", tomorrowStr);
      if (retailErr) throw retailErr;`;

const tomorrowReplacementStr = `      let subDeliveries = [];
      try {
        const { data: subData, error: subErr } = await (supabase as any)
          .from("subscription_deliveries")
          .select(\`
            *,
            profiles:user_id (id, full_name, phone, email),
            subscription_delivery_items (*),
            addresses:delivery_address_id (*)
          \`)
          .eq("delivery_date", tomorrowStr);
        if (subErr) throw subErr;
        subDeliveries = subData || [];
      } catch (err: any) {
        console.error("Subscription Pipeline Error (Tomorrow):", err);
        toast.error("Failed to fetch subscription items: " + err.message);
      }

      let retailDeliveries = [];
      try {
        const { data: retailData, error: retailErr } = await (supabase as any)
          .from("one_time_orders")
          .select(\`
            *,
            profiles:user_id (id, full_name, phone, email),
            one_time_order_items (*),
            addresses:delivery_address_id (*)
          \`)
          .eq("delivery_date", tomorrowStr);
        if (retailErr) throw retailErr;
        retailDeliveries = retailData || [];
      } catch (err: any) {
        console.error("Retail Pipeline Error (Tomorrow):", err);
        toast.error("Failed to fetch retail items: " + err.message);
      }`;

code = code.replace(tomorrowTargetStr, tomorrowReplacementStr);

fs.writeFileSync(path, code);
console.log('AdminLogistics.tsx rewritten');
