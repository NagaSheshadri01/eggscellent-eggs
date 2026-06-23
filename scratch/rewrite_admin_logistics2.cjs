const fs = require('fs');

const path = 'scratch/AdminLogistics.tsx';
let code = fs.readFileSync(path, 'utf8');

// Update bulkAssignMutation
const oldBulkAssign = `const bulkAssignMutation = useMutation({
    mutationFn: async ({ stopIds, partnerId }: { stopIds: string[]; partnerId: string }) => {
      const selectedDriverId = partnerId === "unassigned" ? null : partnerId;
      
      const { error } = await (supabase as any)
        .from('master_orders')
        .update({ delivery_partner_id: selectedDriverId })
        .in('user_id', stopIds)
        .in('delivery_date', [todayStr, tomorrowStr]);
      
      if (error) throw error;
      
      const { error: ledgerError } = await (supabase as any)
        .from('delivery_ledger')
        .update({ delivery_partner_id: selectedDriverId })
        .in('user_id', stopIds)
        .in('delivery_date', [todayStr, tomorrowStr]);
        
      if (ledgerError) throw ledgerError;

      const { error: ordersError } = await (supabase as any)
        .from('orders')
        .update({ delivery_partner_id: selectedDriverId })
        .in('user_id', stopIds)
        .in('scheduled_date', [todayStr, tomorrowStr]);
        
      if (ordersError) throw ordersError;
    },`;

const newBulkAssign = `const bulkAssignMutation = useMutation({
    mutationFn: async ({ stopKeys, partnerId }: { stopKeys: DeliveryStop[]; partnerId: string }) => {
      const selectedDriverId = partnerId === "unassigned" ? null : partnerId;
      
      const subDelivIds = stopKeys.flatMap(sk => sk.deliveryIds);
      const retailIds = stopKeys.flatMap(sk => sk.oneTimeIds);

      if (subDelivIds.length > 0) {
        const { error } = await (supabase as any)
          .from('subscription_deliveries')
          .update({ delivery_partner_id: selectedDriverId })
          .in('id', subDelivIds);
        if (error) throw error;
      }
      
      if (retailIds.length > 0) {
        const { error } = await (supabase as any)
          .from('one_time_orders')
          .update({ delivery_partner_id: selectedDriverId })
          .in('id', retailIds);
        if (error) throw error;
      }
    },`;

code = code.replace(oldBulkAssign, newBulkAssign);

// Update badging in UI
const oldItemRender = `                  {stop.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm p-3 bg-secondary/10 rounded-xl">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold">
                          {item.quantity}x {item.productSlug || item.product_slug || "Product"}
                        </span>
                        {(item as any).is_instant ? (
                          <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full inline-block w-fit">
                            📦 One-Time Add-on
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block w-fit flex items-center gap-1">
                            <Repeat className="w-3 h-3" /> Subscription Delivery
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.status === 'out_of_stock' ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => updateItemStatusMutation.mutate({ ledgerId: item.ledgerId || item.id, newStatus: 'pending' })}
                          >
                            <RefreshCcw className="w-3 h-3 mr-1" /> Restore Stock
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive"
                            onClick={() => updateItemStatusMutation.mutate({ ledgerId: item.ledgerId || item.id, newStatus: 'out_of_stock' })}
                          >
                            <PackageX className="w-3 h-3 mr-1" /> Mark Out of Stock
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}`;

const newItemRender = `                  {stop.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center text-sm p-3 bg-secondary/10 rounded-xl">
                      <div className="flex flex-col gap-1">
                        <span className="font-bold">
                          {item.quantity}x {item.product_slug || "Product"}
                        </span>
                        {item.sourceType === 'one_time' ? (
                          <span className="text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full inline-block w-fit">
                            📦 One-Time Add-on
                          </span>
                        ) : (
                          <span className="text-[10px] uppercase font-bold text-green-600 bg-green-100 px-2 py-0.5 rounded-full inline-block w-fit flex items-center gap-1">
                            <Repeat className="w-3 h-3" /> Subscription Delivery
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2">
                        {item.status === 'out_of_stock' ? (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, sourceType: item.sourceType, newStatus: 'pending' })}
                          >
                            <RefreshCcw className="w-3 h-3 mr-1" /> Restore Stock
                          </Button>
                        ) : (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="text-destructive"
                            onClick={() => updateItemStatusMutation.mutate({ itemId: item.id, sourceType: item.sourceType, newStatus: 'out_of_stock' })}
                          >
                            <PackageX className="w-3 h-3 mr-1" /> Mark Out of Stock
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}`;

code = code.replace(oldItemRender, newItemRender);

// In bulk match handle selection changes:
// The code uses selectedStopIds (array of user_ids).
// For the bulkAssignMutation.mutate call:
code = code.replace(/bulkAssignMutation\.mutate\(\{\n\s*stopIds: selectedStopIds,\n\s*partnerId: targetPartnerId\n\s*\}\)/g, 
`bulkAssignMutation.mutate({
                          stopKeys: activeManifest.filter(s => selectedStopIds.includes(s.userId)),
                          partnerId: targetPartnerId
                        })`);

fs.writeFileSync(path, code);
console.log('AdminLogistics.tsx fully patched.');
