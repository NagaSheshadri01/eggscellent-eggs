import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, Truck, Calendar, MapPin, AlertCircle, RefreshCw, Box } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

export const AdminLogistics = () => {
  const [activeTab, setActiveTab] = useState("live-dispatch");
  const queryClient = useQueryClient();

  const getTomorrowString = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const year = t.getFullYear();
    const month = String(t.getMonth() + 1).padStart(2, '0');
    const day = String(t.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const tomorrowStr = getTomorrowString();

  const liveDispatchQ = useQuery({
    queryKey: ["admin-logistics-live-dispatch"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("one_time_orders")
        .select(`
          *,
          profiles:user_id (id, full_name, phone, email),
          one_time_order_items (*, products (name)),
          addresses:delivery_address_id (*)
        `)
        .in("status", ["pending", "confirmed", "out_for_delivery"]);
      if (error) throw error;
      return data || [];
    }
  });

  const morningManifestsQ = useQuery({
    queryKey: ["admin-logistics-morning-manifests", tomorrowStr],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("manifests")
        .select(`
          id, delivery_date, status, driver_id,
          manifest_drops (
            id, product_slug, quantity, status, user_id, escrow_amount,
            addresses:address_id (pincode, latitude, longitude, address_line_1, city),
            profiles:user_id (full_name, phone),
            products:product_slug (name)
          )
        `)
        .eq("delivery_date", tomorrowStr);
      if (error) throw error;
      return data || [];
    }
  });

  const toggleStockMutation = useMutation({
    mutationFn: async ({ dropId, isOutOfStock }: { dropId: string; isOutOfStock: boolean }) => {
      const { error } = await supabase.rpc("toggle_drop_stock_status", {
        p_drop_id: dropId,
        p_is_out_of_stock: isOutOfStock
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-logistics-morning-manifests"] });
    }
  });

  const productTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const manifests = morningManifestsQ.data || [];
    manifests.forEach((m: any) => {
      (m.manifest_drops || []).forEach((drop: any) => {
        const slug = drop.products?.name || drop.product_slug;
        if (!totals[slug]) totals[slug] = 0;
        totals[slug] += drop.quantity;
      });
    });
    return totals;
  }, [morningManifestsQ.data]);

  const groupedByPincode = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const manifests = morningManifestsQ.data || [];
    manifests.forEach((m: any) => {
      (m.manifest_drops || []).forEach((drop: any) => {
        const pin = drop.addresses?.pincode || "Unassigned Pincode";
        if (!groups[pin]) groups[pin] = [];
        groups[pin].push(drop);
      });
    });
    return groups;
  }, [morningManifestsQ.data]);

  if (liveDispatchQ.error) {
    console.error("Supabase Error (liveDispatch):", liveDispatchQ.error);
  }
  if (morningManifestsQ.error) {
    console.error("Supabase Error (morningManifests):", morningManifestsQ.error);
  }

  return (
    <div className="space-y-6 pb-28">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Administrative Logistics Board</h1>
          <p className="text-sm text-muted-foreground mt-1">Supervise manifests and live retail dispatch.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-secondary/40 p-1 mb-6">
          <TabsTrigger value="live-dispatch" className="flex items-center gap-2">
            <Package className="w-4 h-4" /> Live Dispatch
          </TabsTrigger>
          <TabsTrigger value="morning-manifests" className="flex items-center gap-2">
            <Truck className="w-4 h-4" /> Morning Manifests
          </TabsTrigger>
        </TabsList>

        <TabsContent value="live-dispatch" className="space-y-6">
          {liveDispatchQ.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading dispatch board...</div>
          ) : liveDispatchQ.error ? (
            <div className="p-8 text-center text-red-500 font-bold">Error: {(liveDispatchQ.error as any)?.message || "An error occurred"}</div>
          ) : liveDispatchQ.data?.length === 0 ? (
            <div className="bg-card border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
              <Package className="w-8 h-8 text-primary/50 mb-4" />
              <h3 className="font-display font-bold text-brown text-xl">No Live Retail Orders</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                There are currently zero active one-time retail orders pending dispatch.
              </p>
            </div>
          ) : (
            <div className="grid gap-4">
              {liveDispatchQ.data?.map((order: any) => (
                <div key={order.id} className="bg-card p-4 rounded-2xl border flex items-center justify-between">
                  <div>
                    <h3 className="font-bold">{order.profiles?.full_name || 'Unknown Customer'}</h3>
                    <p className="text-xs text-muted-foreground">{order.addresses?.address_line_1 || 'No Address'}</p>
                    <div className="mt-2 flex gap-2">
                      {order.one_time_order_items?.map((item: any) => (
                        <span key={item.id} className="text-xs bg-secondary px-2 py-1 rounded-md font-medium">
                          {item.quantity}x {item.products?.name || item.product_slug}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1 rounded-full">
                      {order.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="morning-manifests" className="space-y-6">
          <div className="flex items-center gap-2 bg-white px-4 py-3 rounded-2xl border border-border/80 w-fit">
            <Calendar className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-brown">
              Tomorrow's Date: {tomorrowStr}
            </span>
          </div>

          {morningManifestsQ.isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Loading manifests...</div>
          ) : morningManifestsQ.error ? (
            <div className="p-8 text-center text-red-500 font-bold">Error: {(morningManifestsQ.error as any)?.message || "An error occurred"}</div>
          ) : Object.keys(productTotals).length === 0 ? (
            <div className="bg-card border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center py-16 text-center">
              <Truck className="w-8 h-8 text-primary/50 mb-4" />
              <h3 className="font-display font-bold text-brown text-xl">No Manifest Drops Generated</h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-sm">
                The manifest engine has not generated any drops for tomorrow yet, or there are zero active subscriptions.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {/* Aggregated Load Sheet */}
              <div className="bg-card border rounded-2xl overflow-hidden shadow-sm">
                <div className="bg-secondary/40 px-6 py-4 border-b">
                  <h3 className="font-display font-bold text-brown text-lg">Aggregated Load Sheet</h3>
                  <p className="text-xs text-muted-foreground">Total product quantities required for all routes.</p>
                </div>
                <div className="divide-y divide-border/50">
                  {Object.entries(productTotals).map(([slug, qty]) => (
                    <div key={slug} className="px-6 py-4 flex items-center justify-between hover:bg-secondary/10 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary font-bold">
                          {String(slug).substring(0, 2).toUpperCase()}
                        </div>
                        <span className="font-bold text-brown text-base">{slug}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-2xl font-extrabold text-brown">{qty}</span>
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Units</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Pincode Command Center */}
              <div className="space-y-6">
                <h3 className="font-display font-bold text-brown text-xl border-b pb-2">Command Center: Route Dispatch</h3>
                
                {Object.entries(groupedByPincode).map(([pincode, drops]) => (
                  <div key={pincode} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                    
                    {/* Level 1: Pincode Header */}
                    <div className="bg-amber-50/50 px-5 py-4 border-b flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Checkbox id={`select-all-${pincode}`} />
                        <div>
                          <label htmlFor={`select-all-${pincode}`} className="font-display font-extrabold text-brown text-lg tracking-tight cursor-pointer">
                            Pincode: {pincode}
                          </label>
                          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">{drops.length} Drops Pending</p>
                        </div>
                      </div>
                    </div>

                    <div className="divide-y divide-border/40">
                      {drops.map((drop: any) => (
                        <div key={drop.id} className="p-5 flex flex-col md:flex-row gap-6 hover:bg-secondary/5 transition-colors">
                          
                          {/* Level 2: Customer Row */}
                          <div className="flex-1 flex items-start gap-4">
                            <Checkbox id={`select-${drop.id}`} className="mt-1" />
                            <div className="space-y-1">
                              <h4 className="font-bold text-stone-900 text-base">{drop.profiles?.full_name || 'Unknown'}</h4>
                              <p className="text-sm font-medium text-stone-500">{drop.profiles?.phone || 'No Phone'}</p>
                              
                              {/* Level 3: Map Integration */}
                              <div className="flex items-center gap-2 pt-2">
                                <a 
                                  href={`https://www.google.com/maps/search/?api=1&query=${drop.addresses?.latitude || 0},${drop.addresses?.longitude || 0}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all shrink-0"
                                  title="Open in Google Maps"
                                >
                                  <MapPin className="w-4 h-4" />
                                </a>
                                <span className="text-xs text-muted-foreground truncate max-w-[200px] sm:max-w-[300px]">
                                  {drop.addresses?.address_line_1 || 'No Address Provided'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Level 4: Fulfillment Details */}
                          <div className="w-full md:w-80 bg-stone-50 rounded-xl p-4 border border-stone-100 flex flex-col justify-between gap-4 relative overflow-hidden">
                            {drop.status === 'out_of_stock' && (
                              <div className="absolute top-0 right-0 w-2 h-full bg-red-500"></div>
                            )}
                            
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-bold text-stone-400 uppercase tracking-widest flex items-center gap-1"><Box className="w-3 h-3"/> Box ID</span>
                                <span className="text-[10px] font-mono text-stone-500">{drop.id.slice(0,8)}</span>
                              </div>
                              <div className="flex justify-between items-end mt-3">
                                <span className="font-bold text-stone-800">{drop.products?.name || drop.product_slug}</span>
                                <div className="text-right">
                                  <span className="text-2xl font-black text-primary leading-none">{drop.quantity}</span>
                                  <span className="text-xs font-bold text-stone-400 ml-1">QTY</span>
                                </div>
                              </div>
                            </div>

                            <div className="pt-2 border-t border-stone-200">
                              {drop.status === 'out_of_stock' ? (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="w-full bg-white border-dashed border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => toggleStockMutation.mutate({ dropId: drop.id, isOutOfStock: false })}
                                  disabled={toggleStockMutation.isPending}
                                >
                                  <RefreshCw className="w-4 h-4 mr-2" />
                                  Restore Stock
                                </Button>
                              ) : (
                                <Button 
                                  size="sm" 
                                  variant="destructive"
                                  className="w-full shadow-sm hover:shadow-md transition-shadow"
                                  onClick={() => toggleStockMutation.mutate({ dropId: drop.id, isOutOfStock: true })}
                                  disabled={toggleStockMutation.isPending}
                                >
                                  <AlertCircle className="w-4 h-4 mr-2" />
                                  Mark Out of Stock
                                </Button>
                              )}
                            </div>
                          </div>

                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminLogistics;
