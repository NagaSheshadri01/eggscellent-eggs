const fs = require('fs');

const path = 'src/components/site/CartDrawer.tsx';
let content = fs.readFileSync(path, 'utf8');

const regex = /\/\/\ 2\. Process Subscription Items[\s\S]*?(?=setPlacing\(false\);\s*placedRef\.current = true;)/;

const newCode = `// 2. Process Subscription Items
    if (subItems.length > 0) {
      // Pre-validate that all subscription items can resolve a valid product UUID
      for (const i of subItems) {
        const product = allProducts?.find(p => p.slug === i.slug || p.name === i.slug || p.id === i.id);
        if (!product) {
          toast.error(\`Could not resolve catalog product for subscription: \${i.name}. Please contact support.\`);
          setPlacing(false);
          return;
        }
      }

      const subscriptionPayloads = subItems.map(i => {
          const resolvedSlug = allProducts?.find(p => p.slug === i.slug || p.name === i.slug || p.id === i.id)?.slug || i.slug;
          const plan = activePlans?.find(p =>
            (p.product_slug === resolvedSlug || p.product_slug === i.slug) &&
            p.frequency_type === i.frequency_type
          );
          const isWeekly = i.frequency_type === 'weekly';
          return {
             user_id: user.id,
             address_id: selectedAddressId,
             status: 'active',
             payment_method: 'wallet',
             wallet_mode: 'TRUE',
             display_id: Math.random().toString(36).substring(2, 10).toUpperCase(),
             product_slug: resolvedSlug,
             quantity: i.qty,
             frequency: i.frequency_type,
             selected_days: i.subscription_days || (isWeekly ? [selectedWeeklyDay] : (plan?.frequency_type === 'alternate' ? (
                (() => {
                  const cDays = plan?.custom_days || [];
                  const dividerIndex = cDays.indexOf(-1);
                  return dividerIndex === -1 ? (cDays.length > 0 ? cDays : [0, 2, 4]) : cDays.slice(0, dividerIndex);
                })()
             ) : [0, 1, 2, 3, 4, 5, 6]))
          };
      });

      const { data: subContracts, error: contractErr } = await (supabase as any)
          .from("subscriptions")
          .insert(subscriptionPayloads)
          .select();

      if (contractErr || !subContracts || subContracts.length === 0) {
        toast.error("Subscriptions contract failed to save: " + contractErr?.message);
        setPlacing(false);
        return;
      }

      // IMMEDIATE downstream delivery manifest generator execution post-subscription success:
      const deliveryDates: string[] = [];
      const today = new Date();
      for (let i = 1; i <= 14; i++) {
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + i);
        const dateString = targetDate.toISOString().split('T')[0];
        deliveryDates.push(dateString);
      }

      const deliveryPayloads: any[] = [];
      subContracts.forEach((contract: any) => {
         deliveryDates.forEach(date => {
            deliveryPayloads.push({
               user_id: user.id,
               subscription_id: contract.id,
               product_slug: contract.product_slug,
               quantity: contract.quantity,
               escrow_amount: subItems.find(i => i.slug === contract.product_slug || i.name === contract.product_slug)?.discountPrice || 0,
               status: 'pending'
            });
         });
      });

      const { error: deliveryGenError } = await (supabase as any)
        .from('manifest_drops')
        .insert(deliveryPayloads);

      if (deliveryGenError) {
        console.error("Downstream calendar generation failed:", deliveryGenError);
      }
    }

    `;

content = content.replace(regex, newCode);
fs.writeFileSync(path, content, 'utf8');
console.log('CartDrawer patched');
