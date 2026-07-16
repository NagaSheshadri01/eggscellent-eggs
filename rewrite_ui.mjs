import fs from 'fs';

const currentCode = fs.readFileSync('src/pages/admin/AdminLogistics.tsx', 'utf-8');

const newCode = `import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Package, Truck, Calendar, RefreshCw, AlertCircle, MapPin, Box } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const AdminLogistics = () => {
  const [activeTab, setActiveTab] = useState("live-dispatch");
  const [selectedDrops, setSelectedDrops] = useState<string[]>([]);
  const queryClient = useQueryClient();

  const handleSelectAll = (ids: string[], isChecked: boolean) => {
    if (isChecked) {
      setSelectedDrops(prev => Array.from(new Set([...prev, ...ids])));
    } else {
      setSelectedDrops(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  const handleSelectOne = (id: string, isChecked: boolean) => {
    if (isChecked) {
      setSelectedDrops(prev => [...prev, id]);
    } else {
      setSelectedDrops(prev => prev.filter(v => v !== id));
    }
  };

  const getTomorrowString = () => {
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const year = t.getFullYear();
    const month = String(t.getMonth() + 1).padStart(2, '0');
    const day = String(t.getDate()).padStart(2, '0');
    return \`\${year}-\${month}-\${day}\`;
  };

  const tomorrowStr = getTomorrowString();

  const liveDispatchQ = useQuery({
    queryKey: ["admin-logistics-live-dispatch"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("one_time_orders")
        .select(\`
          *,
          profiles:user_id (id, full_name, phone, email),
          one_time_order_items (*, products (name)),
          addresses:delivery_address_id (*)
        \`)
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
        .select(\`
          id, delivery_date, status, driver_id,
          manifest_drops (
            id, product_slug, quantity, status, user_id, escrow_amount,
            addresses:address_id (pincode, latitude, longitude, address_line_1, city),
            profiles:user_id (full_name, phone),
            products (name)
          )
        \`)
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

  const groupedByPincodeAndCity = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    const manifests = morningManifestsQ.data || [];
    manifests.forEach((m: any) => {
      (m.manifest_drops || []).forEach((drop: any) => {
        const pin = drop.addresses?.pincode || "Unassigned Pincode";
        const city = drop.addresses?.city || "Unknown City";
        if (!groups[pin]) groups[pin] = {};
        if (!groups[pin][city]) groups[pin][city] = [];
        groups[pin][city].push(drop);
      });
    });
    return groups;
  }, [morningManifestsQ.data]);

  const groupedLiveDispatch = useMemo(() => {
    return (liveDispatchQ.data || []).reduce((groups: Record<string, Record<string, any[]>>, order: any) => {
      const pin = order.addresses?.pincode || "Unassigned Pincode";
      const city = order.addresses?.city || "Unknown City";
      if (!groups[pin]) groups[pin] = {};
      if (!groups[pin][city]) groups[pin][city] = [];
      groups[pin][city].push(order);
      return groups;
    }, {});
  }, [liveDispatchQ.data]);

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
            <div className="space-y-6">
              <h3 className="font-display font-bold text-brown text-xl border-b pb-2">Live Dispatch Command Center</h3>
              {Object.entries(groupedLiveDispatch).map(([pincode, cityGroups]) => (
                <div key={pincode} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                  {/* Level 1: Pincode Header */}
                  <div className="bg-amber-50/50 px-5 py-4 border-b flex items-center justify-between">
                    <div>
                      <h4 className="font-display font-extrabold text-brown text-lg tracking-tight">
                        Pincode: {pincode}
                      </h4>
                      <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                        {Object.values(cityGroups).flat().length} Orders Pending
                      </p>
                    </div>
                  </div>

                  <Accordion type="multiple" className="w-full">
                    {Object.entries(cityGroups).map(([city, orders]) => (
                      <AccordionItem key={city} value={city} className="border-b last:border-0 px-5">
                        {/* Level 2: City Accordion */}
                        <AccordionTrigger className="hover:no-underline">
                          <div className="flex items-center gap-4 text-left">
                            <Checkbox 
                              checked={orders.every((o: any) => selectedDrops.includes(o.id))}
                              onCheckedChange={(c) => {
                                handleSelectAll(orders.map((o: any) => o.id), c as boolean);
                              }}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div>
                              <span className="font-bold text-stone-800">{city}</span>
                              <span className="ml-2 text-xs text-stone-500 font-medium bg-stone-100 px-2 py-1 rounded-full">
                                {orders.length} orders
                              </span>
                            </div>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          {/* Level 3: The Data Table */}
                          <div className="overflow-x-auto pb-4">
                            <Table className="min-w-[800px]">
                              <TableHeader className="bg-stone-50">
                                <TableRow>
                                  <TableHead className="w-[50px]"></TableHead>
                                  <TableHead>CUSTOMER INFO</TableHead>
                                  <TableHead>FULFILLMENT STOP DETAILS</TableHead>
                                  <TableHead>BUILDING / DOOR ADDRESS</TableHead>
                                  <TableHead className="text-right">ASSIGNED DRIVER</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {orders.map((order: any) => {
                                  const totalQty = order.one_time_order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0;
                                  return (
                                    <TableRow key={order.id}>
                                      <TableCell>
                                        <Checkbox 
                                          checked={selectedDrops.includes(order.id)}
                                          onCheckedChange={(c) => handleSelectOne(order.id, c as boolean)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div className="font-bold text-stone-900">{order.profiles?.full_name || 'Unknown'}</div>
                                        <div className="text-xs text-stone-500 mt-1">{order.profiles?.phone || 'No Phone'}</div>
                                        <div className="inline-block mt-2 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          TOTAL: {totalQty}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="bg-black text-white text-[10px] font-mono px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 w-fit">
                                            <Box className="w-3 h-3" /> BOX ID: {order.display_id || order.id.slice(0, 8)}
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          {order.one_time_order_items?.map((item: any) => (
                                            <div key={item.id} className="text-sm font-medium flex gap-2 items-center">
                                              <span>{item.quantity}x</span>
                                              <span>{item.products?.name || item.product_slug}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm text-stone-700 max-w-[200px] truncate mb-2">
                                          {order.addresses?.address_line_1 || 'No Address Provided'}
                                        </div>
                                        <a
                                          href={\`https://www.google.com/maps?q=\${order.addresses?.latitude},\${order.addresses?.longitude}\`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all text-xs font-bold"
                                        >
                                          🗺️ Map
                                        </a>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">
                                          {order.status}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
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
                {Object.entries(groupedByPincodeAndCity).map(([pincode, cityGroups]) => (
                  <div key={pincode} className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                    {/* Level 1: Pincode Header */}
                    <div className="bg-amber-50/50 px-5 py-4 border-b flex items-center justify-between">
                      <div>
                        <h4 className="font-display font-extrabold text-brown text-lg tracking-tight">
                          Pincode: {pincode}
                        </h4>
                        <p className="text-xs font-bold text-amber-700 uppercase tracking-widest">
                          {Object.values(cityGroups).flat().length} Drops Pending
                        </p>
                      </div>
                    </div>

                    <Accordion type="multiple" className="w-full">
                      {Object.entries(cityGroups).map(([city, drops]) => (
                        <AccordionItem key={city} value={city} className="border-b last:border-0 px-5">
                          {/* Level 2: City Accordion */}
                          <AccordionTrigger className="hover:no-underline">
                            <div className="flex items-center gap-4 text-left">
                              <Checkbox 
                                checked={drops.every((d: any) => selectedDrops.includes(d.id))}
                                onCheckedChange={(c) => {
                                  handleSelectAll(drops.map((d: any) => d.id), c as boolean);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <div>
                                <span className="font-bold text-stone-800">{city}</span>
                                <span className="ml-2 text-xs text-stone-500 font-medium bg-stone-100 px-2 py-1 rounded-full">
                                  {drops.length} drops
                                </span>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {/* Level 3: The Data Table */}
                            <div className="overflow-x-auto pb-4">
                              <Table className="min-w-[800px]">
                                <TableHeader className="bg-stone-50">
                                  <TableRow>
                                    <TableHead className="w-[50px]"></TableHead>
                                    <TableHead>CUSTOMER INFO</TableHead>
                                    <TableHead>FULFILLMENT STOP DETAILS</TableHead>
                                    <TableHead>BUILDING / DOOR ADDRESS</TableHead>
                                    <TableHead className="text-right">ASSIGNED DRIVER</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {drops.map((drop: any) => (
                                    <TableRow key={drop.id}>
                                      <TableCell>
                                        <Checkbox 
                                          checked={selectedDrops.includes(drop.id)}
                                          onCheckedChange={(c) => handleSelectOne(drop.id, c as boolean)}
                                        />
                                      </TableCell>
                                      <TableCell>
                                        <div className="font-bold text-stone-900">{drop.profiles?.full_name || 'Unknown'}</div>
                                        <div className="text-xs text-stone-500 mt-1">{drop.profiles?.phone || 'No Phone'}</div>
                                        <div className="inline-block mt-2 text-[10px] font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          TOTAL: {drop.quantity}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="flex items-center gap-2 mb-2">
                                          <div className="bg-black text-white text-[10px] font-mono px-2 py-1 rounded-full uppercase tracking-wider flex items-center gap-1 w-fit">
                                            <Box className="w-3 h-3" /> BOX ID: {drop.id.slice(0, 8)}
                                          </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                          <div className="text-sm font-medium flex gap-2 items-center">
                                            <span>{drop.quantity}x</span>
                                            <span>{drop.products?.name || drop.product_slug}</span>
                                          </div>
                                          {drop.status === 'out_of_stock' ? (
                                            <Button
                                              size="sm"
                                              variant="outline"
                                              className="bg-white border-dashed border-green-200 text-green-600 hover:bg-green-50 hover:text-green-700 h-8"
                                              onClick={() => toggleStockMutation.mutate({ dropId: drop.id, isOutOfStock: false })}
                                              disabled={toggleStockMutation.isPending}
                                            >
                                              <RefreshCw className="w-3 h-3 mr-1" /> Restore Stock
                                            </Button>
                                          ) : (
                                            <Button
                                              size="sm"
                                              variant="destructive"
                                              className="shadow-sm hover:shadow-md transition-shadow h-8"
                                              onClick={() => toggleStockMutation.mutate({ dropId: drop.id, isOutOfStock: true })}
                                              disabled={toggleStockMutation.isPending}
                                            >
                                              <AlertCircle className="w-3 h-3 mr-1" /> Mark Out of Stock
                                            </Button>
                                          )}
                                        </div>
                                      </TableCell>
                                      <TableCell>
                                        <div className="text-sm text-stone-700 max-w-[200px] truncate mb-2">
                                          {drop.addresses?.address_line_1 || 'No Address Provided'}
                                        </div>
                                        <a
                                          href={\`https://www.google.com/maps?q=\${drop.addresses?.latitude},\${drop.addresses?.longitude}\`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-50 text-blue-600 hover:bg-blue-100 hover:scale-105 transition-all text-xs font-bold"
                                        >
                                          🗺️ Map
                                        </a>
                                      </TableCell>
                                      <TableCell className="text-right">
                                        <span className="inline-flex items-center text-xs font-bold uppercase tracking-wider bg-amber-100 text-amber-800 px-3 py-1.5 rounded-full">
                                          {drop.status}
                                        </span>
                                      </TableCell>
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Driver Assignment Action Bar */}
      {selectedDrops.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 p-4 shadow-[0_-4px_20px_-10px_rgba(0,0,0,0.1)] z-50 animate-in slide-in-from-bottom-4">
          <div className="container max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 text-primary font-bold px-4 py-2 rounded-xl">
                {selectedDrops.length} stop{selectedDrops.length > 1 ? 's' : ''} selected
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedDrops([])}>
                Clear
              </Button>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <select className="flex h-10 w-full sm:w-64 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
                <option value="">Select Delivery Partner...</option>
                <option value="driver-1">Driver: Raj Kumar (Zone A)</option>
                <option value="driver-2">Driver: Amit Singh (Zone B)</option>
              </select>
              <Button className="w-full sm:w-auto whitespace-nowrap shadow-md hover:shadow-lg transition-all" size="lg">
                Assign Driver
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminLogistics;
`;

fs.writeFileSync('src/pages/admin/AdminLogistics.tsx', newCode, 'utf-8');
console.log("SUCCESS");
