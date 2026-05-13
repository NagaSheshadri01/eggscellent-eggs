import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

const STATUSES = ["placed","confirmed","packed","out_for_delivery","delivered","cancelled"];
const PENDING = ["placed","confirmed","packed","out_for_delivery"];

const AdminOrders = () => {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [tab, setTab] = useState<"all"|"today"|"pending"|"delivered"|"cancelled">("all");
  const [q, setQ] = useState("");

  const load = async () => {
    const { data } = await supabase.from("orders").select("id,total,order_status,payment_status,created_at,user_id").order("created_at", { ascending: false }).limit(500);
    setOrders(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const update = async (id: string, status: string) => {
    const { error } = await supabase.from("orders").update({ order_status: status as any }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Updated"); load(); }
  };

  const todayKey = new Date().toISOString().slice(0,10);
  const filtered = (orders ?? []).filter(o => {
    if (q && !o.id.toLowerCase().includes(q.toLowerCase())) return false;
    if (tab === "today") return o.created_at.slice(0,10) === todayKey;
    if (tab === "pending") return PENDING.includes(o.order_status);
    if (tab === "delivered") return o.order_status === "delivered";
    if (tab === "cancelled") return o.order_status === "cancelled";
    return true;
  });

  return (
    <div>
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">Orders</h1>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="mb-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="today">Today</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="cancelled">Cancelled</TabsTrigger>
        </TabsList>
      </Tabs>
      <div className="flex gap-2 mb-4">
        <Input placeholder="Search by order ID" value={q} onChange={e => setQ(e.target.value)} className="max-w-xs" />
      </div>

      <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
        {orders === null ? <Skeleton className="h-80" /> : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Payment</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(o => (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-4 py-3 font-mono text-xs"><Link to={`/admin/orders/${o.id}`} className="text-brown hover:underline">#{o.id.slice(0,8).toUpperCase()}</Link></td>
                  <td className="px-4 py-3">{new Date(o.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 font-semibold text-brown">₹{o.total}</td>
                  <td className="px-4 py-3"><span className="text-xs px-2 py-1 rounded bg-secondary">{o.payment_status}</span></td>
                  <td className="px-4 py-3">
                    <Select value={o.order_status} onValueChange={(v) => update(o.id, v)}>
                      <SelectTrigger className="w-44 h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && <tr><td colSpan={5} className="text-center py-10 text-muted-foreground">No orders found</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default AdminOrders;
