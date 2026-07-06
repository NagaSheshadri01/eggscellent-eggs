const fs = require('fs');

function replaceInFile(filePath, replacements) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');
    for (const [regex, replacement] of replacements) {
        content = content.replace(regex, replacement);
    }
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Patched", filePath);
}

// 1. SubscriptionCalendar.tsx
replaceInFile('src/components/account/SubscriptionCalendar.tsx', [
    [
        /.from\('subscription_deliveries'\)\s*\.select\('id, delivery_date, status, subscription_delivery_items\(id, product_slug, quantity, effective_price\)'\)\s*\.eq\('user_id', uid\)\s*\.gte\('delivery_date', startStr\)\s*\.lte\('delivery_date', endStr\);/m,
        `.from('manifest_drops')
        .select('id, status, product_slug, quantity, escrow_amount, manifests!inner(delivery_date)')
        .eq('user_id', uid)
        .gte('manifests.delivery_date', startStr)
        .lte('manifests.delivery_date', endStr);`
    ],
    [
        /\(del\.subscription_delivery_items \|\| \[\]\)\.forEach\(\(i: any\) => \{[\s\S]*?\}\);/m,
        `itemsList.push({
            id: del.id,
            delivery_id: del.manifests?.id,
            delivery_date: del.manifests?.delivery_date,
            status: del.status,
            product_slug: del.product_slug,
            quantity: del.quantity,
            effective_price: del.escrow_amount,
            is_manifest: true,
            subscription_id: null
          });`
    ],
    [
        /generatedDropsMap\.set\(del\.delivery_date, true\);/g,
        `generatedDropsMap.set(del.manifests?.delivery_date, true);`
    ]
]);

// 2. AccountSubscriptions.tsx
replaceInFile('src/components/site/AccountSubscriptions.tsx', [
    [/.from\("subscription_calendar_ledger"\)/g, `.from("manifest_drops")`]
]);

// 3. CartDrawer.tsx
replaceInFile('src/components/site/CartDrawer.tsx', [
    [/const \{ error: itemsErr \} = await \(supabase as any\)\.from\("subscription_items"\)\.insert\([\s\S]*?\);/m, `// (Deprecated) Items are now directly on the subscriptions table. \n      const itemsErr = null;`],
    [/.from\('subscription_deliveries'\)/g, `.from('manifest_drops')`]
]);

// 4. useDeliveryCalendar.ts
replaceInFile('src/hooks/useDeliveryCalendar.ts', [
    [/subscription_items \( id, product_slug, quantity, selected_days \)/g, ``],
    [/const itemIds = subs\.flatMap\(\(s\) => s\.subscription_items\.map\(\(si\) => si\.id\)\);/g, `const itemIds = subs.map(s => s.id);`],
    [/.from\("subscription_calendar_ledger"\)/g, `.from("manifest_drops")`],
    [/table: "subscription_calendar_ledger"/g, `table: "manifest_drops"`],
    [/for \(const item of sub\.subscription_items\) \{/g, `const item = sub; {`],
    [/\.select\("id, subscription_items\(id\)"\)/g, `.select("id")`],
    [/if \(\!subs\?\.id \|\| \!subs\.subscription_items \|\| subs\.subscription_items\.length === 0\) \{/g, `if (!subs?.id) {`],
    [/subscription_item_id: subs\.subscription_items\?\.\[0\]\?\.id \|\| null,/g, `/* subscription_item_id removed */`]
]);

// 5. useDriverShift.ts
replaceInFile('src/hooks/useDriverShift.ts', [
    [/subscription_calendar_ledger/g, `manifest_drops`]
]);

// 6. Checkout.tsx
replaceInFile('src/pages/Checkout.tsx', [
    [/const \{ error: subErr \} = await supabase\.from\("subscription_items"\)\.insert\(itemsRows\);/g, `const subErr = null; // Deprecated, columns moved to subscriptions`],
    [/.from\('subscription_deliveries'\)/g, `.from('manifest_drops')`]
]);

// 7. PartnerAccountHistory.tsx
replaceInFile('src/pages/PartnerAccountHistory.tsx', [
    [/.from\("subscription_deliveries"\)/g, `.from("manifest_drops")`]
]);

// 8. runE2eSimulations.ts
replaceInFile('src/test/runE2eSimulations.ts', [
    [/const \{ data: subItem, error: itemErr \} = await supabase\.from\("subscription_items"\)\.insert\([\s\S]*?\);/m, `const itemErr = null;`],
    [/.from\('subscription_deliveries'\)/g, `.from('manifest_drops')`],
    [/supabase\.from\("subscription_deliveries"\)\.select\(\`[\s\S]*?subscription_delivery_items\(product_slug, quantity\)[\s\S]*?\`\)/m, `supabase.from("manifest_drops").select('*')`]
]);

// 9. test_types.ts
replaceInFile('src/test_types.ts', [
    [/subscription_calendar_ledger/g, `manifest_drops`]
]);

console.log("All miscellaneous files patched.");
