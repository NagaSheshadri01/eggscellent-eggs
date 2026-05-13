import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, MapPin, Package } from "lucide-react";

const AdminCustomerDetail = () => {
  const { id } = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [addresses, setAddresses] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("addresses").select("*").eq("user_id", id),
      supabase.from("orders").select("id,total,order_status,created_at").eq("user_id", id).order("created_at", { ascending: false }),
    ]).then(([p, a, o]) => { setProfile(p.data); setAddresses(a.data ?? []); setOrders(o.data ?? []); });
  }, [id]);

  if (!profile) return <Skeleton className="h-80 rounded-2xl" />;

  return (
    <div className="max-w-3xl">
      <Link to="/admin/customers" className="text-sm text-muted-foreground hover:text-brown flex items-center gap-1 mb-4"><ArrowLeft className="w-4 h-4" /> All customers</Link>

      <div className="bg-card rounded-2xl shadow-soft p-6 mb-4">
        <h1 className="font-display font-bold text-brown text-2xl tracking-tight">{profile.full_name || "—"}</h1>
        <div className="text-sm text-muted-foreground mt-1">{profile.email} · {profile.phone || "no phone"}</div>
        <div className="text-xs text-muted-foreground mt-1">Joined {new Date(profile.created_at).toLocaleDateString()}</div>
      </div>

      <div className="bg-card rounded-2xl shadow-soft p-5 mb-4">
        <h3 className="font-display font-semibold text-brown mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Saved addresses ({addresses.length})</h3>
        {addresses.length === 0 ? <p className="text-sm text-muted-foreground">None.</p> : (
          <div className="space-y-2">
            {addresses.map(a => (
              <div key={a.id} className="text-sm border border-border rounded-xl p-3">
                <div className="font-semibold text-brown">{a.label || "Address"} {a.is_default && <span className="text-[10px] uppercase ml-1 px-1.5 py-0.5 rounded bg-primary/20">Default</span>}</div>
                <div className="text-muted-foreground">{a.address_line_1}, {a.city}, {a.state} {a.pincode}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl shadow-soft p-5">
        <h3 className="font-display font-semibold text-brown mb-3 flex items-center gap-2"><Package className="w-4 h-4" /> Orders ({orders.length})</h3>
        {orders.length === 0 ? <p className="text-sm text-muted-foreground">No orders.</p> : (
          <div className="space-y-2">
            {orders.map(o => (
              <Link key={o.id} to={`/admin/orders/${o.id}`} className="flex items-center justify-between p-3 rounded-xl border border-border hover:border-primary/40 transition-smooth text-sm">
                <div>
                  <div className="font-mono text-xs text-brown">#{o.id.slice(0,8).toUpperCase()}</div>
                  <div className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleDateString()} · {o.order_status}</div>
                </div>
                <div className="font-display font-bold text-brown">₹{o.total}</div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminCustomerDetail;