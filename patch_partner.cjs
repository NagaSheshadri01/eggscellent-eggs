const fs = require('fs');

const path = 'src/pages/Partner.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update the subDeliveries query
content = content.replace(
  /.from\('subscription_calendar_ledger'\)[\s\S]*?in\('delivery_date', \[todayStr, tomorrowStr\]\);/m,
  `.from('manifest_drops')
        .select(\`
          *,
          manifests!inner(delivery_date, driver_id),
          subscriptions (
            user_id,
            profiles:user_id (id, full_name, phone),
            addresses:address_id (*)
          )
        \`)
        .eq('manifests.driver_id', user!.id)
        .in('manifests.delivery_date', [todayStr, tomorrowStr]);`
);

// 2. Update real-time listener table
content = content.replace(
  /table: "subscription_calendar_ledger"/,
  'table: "manifest_drops"'
);

// 3. Update the grouping logic
const groupLogicRegex = /const rawStops = subDeliveries\.data \|\| \[\];[\s\S]*?const todayStopsCount = getUniqueStopsCount\(todayStops\);\s*const tomorrowStopsCount = getUniqueStopsCount\(tomorrowStops\);/m;

const newGroupLogic = `const rawStops = subDeliveries.data || [];
          
          // Split stops by date bounds
          const todayStops = rawStops.filter((s: any) => s.manifests?.delivery_date === todayStr);
          const tomorrowStops = rawStops.filter((s: any) => s.manifests?.delivery_date === tomorrowStr);

          // Active stops logic
          const activeStops = todayStops.filter((s: any) => !completedStops[s.id] && s.status !== 'delivered' && s.status !== 'skipped' && s.status !== 'failed');
          const tomorrowActiveStops = tomorrowStops;

          const isFutureShift = subscriptionTab === 'tomorrow';
          const displayStops = isFutureShift ? tomorrowActiveStops : activeStops;

          // Group by user_id
          const userGroups: Record<string, any> = {};
          displayStops.forEach((drop: any) => {
             const uid = drop.user_id;
             if (!userGroups[uid]) {
                userGroups[uid] = {
                   userId: uid,
                   customerInfo: drop.subscriptions?.profiles,
                   address: drop.subscriptions?.addresses,
                   items: [],
                   master_order_id: drop.manifests?.id,
                   custom_order_id: drop.id
                };
             }
             userGroups[uid].items.push({
               ...drop,
               product_slug: drop.product_slug,
               quantity: drop.quantity,
               status: drop.status
             });
          });

          let groupedStops = Object.values(userGroups);
          
          const mappedStops = groupedStops.map((stop: any) => ({
            ...stop,
            latitude: stop.address?.lat || stop.addresses?.lat,
            longitude: stop.address?.lng || stop.addresses?.lng
          }));
          groupedStops = optimizeStopSequence(warehouse, mappedStops);

          // Helper to count unique customer stops for badge tabs
          const getUniqueStopsCount = (itemsList: any[]) => {
             const set = new Set();
             itemsList.forEach((i: any) => {
               if (i.status !== 'failed' && i.status !== 'skipped') {
                  set.add(i.user_id);
               }
             });
             return set.size;
          };

          const todayStopsCount = getUniqueStopsCount(todayStops);
          const tomorrowStopsCount = getUniqueStopsCount(tomorrowStops);`;

content = content.replace(groupLogicRegex, newGroupLogic);

// 4. Update the mark out for delivery button action
content = content.replace(
  /supabase\.from\('subscription_calendar_ledger'\)\.update\(\{ status: 'out_for_delivery' \}\)\.in\('id', pendingIds\)/,
  "supabase.from('manifest_drops').update({ status: 'out_for_delivery' }).in('id', pendingIds)"
);

fs.writeFileSync(path, content);
console.log("Partner.tsx patched");
