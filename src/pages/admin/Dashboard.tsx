import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, ShoppingBag, Users, IndianRupee, Clock, CheckCircle2, XCircle, Trophy } from "lucide-react";
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

const Card = ({ icon: Icon, label, value, accent = "primary" }: any) => (
  <div className="bg-card rounded-2xl shadow-soft p-5">
    <div className={`w-10 h-10 rounded-xl grid place-items-center mb-3 ${accent === "primary" ? "gradient-yolk" : "bg-secondary"}`}>
      <Icon className="w-5 h-5 text-brown" />
    </div>
    <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</div>
    <div className="font-display font-bold text-brown text-2xl tracking-tight mt-1">{value}</div>
  </div>
);

const PENDING = ["placed","confirmed","packed","out_for_delivery"];

const Dashboard = () => {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const [oneTimeOrders, subDeliveries, profiles, oneTimeItems, subItems] = await Promise.all([
        supabase.from("one_time_orders").select("total_amount,created_at,status"),
        supabase.from("manifest_drops").select("created_at,status,escrow_amount"),
        supabase.from("profiles").select("id", { count: "exact", head: true }),
        supabase.from("one_time_order_items").select("product_name,product_slug,quantity,price"),
        supabase.from("manifest_drops").select("product_slug,quantity"),
      ]);
      const list = [
        ...(oneTimeOrders.data ?? []).map((o: any) => ({ total: Number(o.total_amount || 0), created_at: o.created_at, status: o.status })),
        ...(subDeliveries.data ?? []).map((d: any) => {
          const total = Number(d.escrow_amount || 0);
          return { total, created_at: d.created_at, status: d.status };
        })
      ];
      
      const todayKey = new Date().toISOString().slice(0,10);
      const today = list.filter(o => o.created_at.slice(0,10) === todayKey);
      const todayRevenue = today.reduce((s,o) => s + Number(o.total), 0);
      const weekStart = new Date(); weekStart.setDate(weekStart.getDate() - 6);
      const weekRevenue = list.filter(o => new Date(o.created_at) >= weekStart).reduce((s,o) => s + Number(o.total), 0);
      const pending = list.filter(o => PENDING.includes(o.status)).length;
      const delivered = list.filter(o => o.status === "delivered").length;
      const cancelled = list.filter(o => o.status === "cancelled").length;

      const days: { date: string; revenue: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        const rev = list.filter(o => o.created_at.slice(0,10) === key).reduce((s,o) => s + Number(o.total), 0);
        days.push({ date: d.toLocaleDateString(undefined, { weekday: "short" }), revenue: rev });
      }

      const agg = new Map<string, number>();
      (oneTimeItems.data ?? []).forEach((it: any) => {
        const name = it.product_name || it.product_slug;
        agg.set(name, (agg.get(name) || 0) + Number(it.quantity));
      });
      (subItems.data ?? []).forEach((it: any) => {
        const name = it.product_slug;
        agg.set(name, (agg.get(name) || 0) + Number(it.quantity));
      });
      const best = Array.from(agg.entries()).sort((a,b) => b[1]-a[1]).slice(0,5);

      setStats({ todayRevenue, todayCount: today.length, weekRevenue, pending, delivered, cancelled, users: profiles.count ?? 0, days, best });
    })();
  }, []);

  if (!stats) return <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">{Array.from({length:8}).map((_,i)=><Skeleton key={i} className="h-32 rounded-2xl"/>)}</div>;

  return (
    <div>
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">Dashboard</h1>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card icon={IndianRupee} label="Today's revenue" value={`₹${stats.todayRevenue.toLocaleString()}`} />
        <Card icon={ShoppingBag} label="Today's orders" value={stats.todayCount} accent="muted" />
        <Card icon={TrendingUp} label="Weekly revenue" value={`₹${stats.weekRevenue.toLocaleString()}`} />
        <Card icon={Users} label="Customers" value={stats.users} accent="muted" />
        <Card icon={Clock} label="Pending orders" value={stats.pending} accent="muted" />
        <Card icon={CheckCircle2} label="Delivered" value={stats.delivered} />
        <Card icon={XCircle} label="Cancelled" value={stats.cancelled} accent="muted" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card rounded-2xl shadow-soft p-5">
          <h3 className="font-display font-semibold text-brown mb-4">Revenue · last 7 days</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.days}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12 }} />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8,8,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card rounded-2xl shadow-soft p-5">
          <h3 className="font-display font-semibold text-brown mb-4 flex items-center gap-2"><Trophy className="w-4 h-4 text-primary" /> Best sellers</h3>
          {stats.best.length === 0 ? <p className="text-sm text-muted-foreground">No sales yet.</p> : (
            <ol className="space-y-2.5">
              {stats.best.map(([name, qty]: [string, number], i: number) => (
                <li key={name} className="flex items-center gap-3 text-sm">
                  <span className="w-6 h-6 rounded-full bg-secondary grid place-items-center text-xs font-bold text-brown">{i+1}</span>
                  <span className="flex-1 font-semibold text-brown truncate">{name}</span>
                  <span className="text-muted-foreground">{qty} sold</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
