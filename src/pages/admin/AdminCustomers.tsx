import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

const AdminCustomers = () => {
  const [list, setList] = useState<any[] | null>(null);
  useEffect(() => {
    Promise.all([
      supabase.from("profiles").select("*").order("created_at", { ascending: false }),
      supabase.from("user_roles").select("user_id, role")
    ]).then(([profsRes, rolesRes]) => {
      if (profsRes.error) {
        console.error("Error fetching profiles:", profsRes.error.message);
        return;
      }
      const excludedUsers = new Set(
        (rolesRes.data || [])
          .filter((r: any) => r.role === "admin" || r.role === "partner")
          .map((r: any) => r.user_id)
      );
      const customers = (profsRes.data || []).filter((p: any) => !excludedUsers.has(p.id));
      setList(customers);
    });
  }, []);
  return (
    <div>
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">Customers</h1>
      {list === null ? <Skeleton className="h-80 rounded-2xl" /> : (
        <div className="bg-card rounded-2xl shadow-soft overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-secondary/60 text-left text-xs uppercase text-muted-foreground">
              <tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Joined</th></tr>
            </thead>
            <tbody>
              {list.map(u => (
                <tr key={u.id} className="border-t border-border">
                  <td className="px-4 py-3 font-semibold text-brown"><Link to={`/admin/customers/${u.id}`} className="hover:underline">{u.full_name || "—"}</Link></td>
                  <td className="px-4 py-3">{u.email || "—"}</td>
                  <td className="px-4 py-3">{u.phone || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
export default AdminCustomers;
