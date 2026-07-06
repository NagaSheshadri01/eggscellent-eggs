import { Database } from '@/integrations/supabase/types';
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, ChevronUp, Package, MapPin, Clock, Calendar as CalIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { useState, useMemo } from "react";
import Seo from "@/components/Seo";
import { Badge } from "@/components/ui/badge";
import { getSlotLabel } from "@/constants/delivery";

const HistoryShiftCard = ({ date, slotId, orders }: { date: string, slotId: string, orders: any[] }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const slotLabel = orders[0]?.delivery_slots?.label || getSlotLabel(slotId);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden transition-all duration-300">
      <div 
        className="p-5 flex items-center justify-between cursor-pointer hover:bg-secondary/20 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <CalIcon className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-display font-bold text-brown text-base">
              {format(parseISO(date), "MMMM d, yyyy")}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
              <Clock className="w-3 h-3" /> {slotLabel}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="bg-success/5 text-success border-success/20 text-[10px] font-bold py-0.5">
            ✓ {orders.length} Stops Completed
          </Badge>
          <div className="text-muted-foreground">
            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
          </div>
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-border/30 bg-secondary/5 animate-in slide-in-from-top-2 duration-300">
          <div className="p-5 space-y-4">
            {orders.map((o, idx) => (
              <div key={o.id} className="flex items-start gap-4 p-4 bg-white rounded-xl border border-border/40 shadow-xs">
                <div className="w-6 h-6 rounded-full bg-secondary border border-border flex items-center justify-center text-[10px] font-bold text-brown shrink-0">
                  {idx + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="font-bold text-brown text-sm truncate">{o.address_snapshot?.full_name || "Customer"}</span>
                    <span className="font-mono text-[10px] text-muted-foreground uppercase">#{o.id.slice(0, 8)}</span>
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> {o.addresses?.house_no ? `${o.addresses.house_no}, ` : ""}{o.addresses?.building_name || o.address_snapshot?.address_line_1}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

type OneTimeOrderRow = Database['public']['Tables']['one_time_orders']['Row'];

const PartnerAccountHistory = () => {
  const { user } = useAuth();

  const { data: history, isLoading } = useQuery({
    queryKey: ["partner_history", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // 1. Fetch One Time Orders
      const { data: oneTimeData, error: otError } = await supabase
        .from("one_time_orders")
        .select(`
          *,
          addresses:delivery_address_id(*),
          delivery_slots:delivery_slot_key(*)
        ` as any)
        .eq("delivery_partner_id", user!.id)
        .eq("status", "delivered")
        .order("created_at", { ascending: false });
      if (otError) throw otError;

      // 2. Fetch Subscription Deliveries
      const { data: subData, error: subError } = await (supabase as any)
        .from("manifest_drops")
        .select(`
          id,
          delivery_date,
          status,
          created_at,
          addresses:delivery_address_id(*),
          profiles:user_id(full_name, phone)
        `)
        .eq("delivery_partner_id", user!.id)
        .eq("status", "delivered")
        .order("created_at", { ascending: false });
      if (subError) throw subError;

      // Merge and standardize
      const merged = [
        ...((oneTimeData as unknown as OneTimeOrderRow[]) || []).map(o => ({
          ...o,
          isSubscription: false,
          created_at: o.created_at,
          slot_id: o.delivery_slot_key || "unassigned"
        })),
        ...(subData || []).map((s: any) => {
          return {
            id: s.id,
            status: s.status,
            address_snapshot: { full_name: s.profiles?.full_name || "Subscription Customer" },
            addresses: s.addresses || {},
            delivery_slots: { label: "Subscription Delivery" },
            isSubscription: true,
            created_at: s.created_at || new Date(s.delivery_date).toISOString(),
            slot_id: "subscription"
          };
        })
      ];

      return merged.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const groupedHistory = useMemo(() => {
    const groups: Record<string, Record<string, any[]>> = {};
    (history || []).forEach((o: any) => {
      const date = o.created_at.split("T")[0];
      const slotId = o.slot_id || "unassigned";
      
      if (!groups[date]) groups[date] = {};
      if (!groups[date][slotId]) groups[date][slotId] = [];
      groups[date][slotId].push(o);
    });
    return groups;
  }, [history]);

  return (
    <div className="min-h-screen bg-secondary/30">
      <Seo title="Delivery History — Partner Portal" />
      
      <header className="bg-card border-b border-border sticky top-0 z-50">
        <div className="container flex items-center h-16 px-4">
          <Link to="/partner" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-brown transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to Live Feed
          </Link>
          <h1 className="ml-8 font-display font-bold text-brown text-lg uppercase tracking-tight">Driver Logs & History</h1>
        </div>
      </header>

      <main className="container max-w-3xl py-10 px-4">
        {isLoading ? (
          <div className="grid place-items-center py-20">
            <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : Object.keys(groupedHistory).length === 0 ? (
          <div className="text-center py-20 bg-card rounded-3xl border border-dashed border-border/60">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h2 className="text-lg font-bold text-brown mb-2">No past deliveries found</h2>
            <p className="text-sm text-muted-foreground">Completed orders will appear here once archived.</p>
          </div>
        ) : (
          <div className="space-y-8">
            {Object.entries(groupedHistory).map(([date, shifts]) => (
              <div key={date} className="space-y-4">
                <div className="flex items-center gap-2 px-1">
                  <div className="h-px flex-1 bg-border/40" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
                    {format(parseISO(date), "EEEE, MMMM d")}
                  </span>
                  <div className="h-px flex-1 bg-border/40" />
                </div>
                
                <div className="grid gap-4">
                  {Object.entries(shifts).map(([slotId, orders]) => (
                    <HistoryShiftCard key={slotId} date={date} slotId={slotId} orders={orders} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default PartnerAccountHistory;
