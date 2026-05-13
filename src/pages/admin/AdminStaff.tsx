import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Truck, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";

type RoleRow = { id: string; user_id: string; role: "admin" | "partner" | "customer"; profile?: { full_name: string | null; email: string | null; phone: string | null } | null };

const useStaff = () =>
  useQuery({
    queryKey: ["staff_roles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("id, user_id, role")
        .in("role", ["admin", "partner"]);
      if (error) throw error;
      const ids = Array.from(new Set((data ?? []).map((r) => r.user_id)));
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids)
        : { data: [] as any[] };
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return (data ?? []).map((r) => ({ ...r, profile: byId.get(r.user_id) ?? null })) as RoleRow[];
    },
  });

const AdminStaff = () => {
  const qc = useQueryClient();
  const staff = useStaff();
  const [identifier, setIdentifier] = useState("");
  const [role, setRole] = useState<"admin" | "partner">("admin");

  const toE164 = (raw: string) => {
    const cleaned = raw.replace(/[^\d+]/g, "");
    if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;
    if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
    if (/^\d{11,15}$/.test(cleaned)) return `+${cleaned}`;
    return null;
  };

  const promote = useMutation({
    mutationFn: async () => {
      const norm = toE164(identifier.trim());
      if (!norm) throw new Error("Enter a valid phone number (E.164, e.g. +91…)");
      const { data: prof, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone")
        .eq("phone", norm)
        .maybeSingle();
      if (error) throw error;
      if (!prof) throw new Error("No registered user with that phone number");
      const { error: insErr } = await supabase
        .from("user_roles")
        .insert({ user_id: prof.id, role: role as any });
      if (insErr && !insErr.message.includes("duplicate")) throw insErr;
      return prof;
    },
    onSuccess: (prof) => {
      toast.success(`${prof.full_name || prof.phone} is now ${role}`);
      setIdentifier("");
      qc.invalidateQueries({ queryKey: ["staff_roles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const demote = useMutation({
    mutationFn: async (row: RoleRow) => {
      const { error } = await supabase.from("user_roles").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role removed");
      qc.invalidateQueries({ queryKey: ["staff_roles"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Staff & roles</h1>
        <p className="text-sm text-muted-foreground mt-1">Promote a registered user to admin or delivery partner. Changes take effect instantly.</p>
      </div>

      <div className="bg-card rounded-2xl shadow-soft p-5 sm:p-6 space-y-3">
        <h2 className="font-display font-bold text-brown text-lg">Promote a user</h2>
        <div className="grid sm:grid-cols-[2fr_1fr_auto] gap-2 items-end">
          <div>
            <Label>Phone number</Label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
          </div>
          <div>
            <Label>Role</Label>
            <Select value={role} onValueChange={(v: any) => setRole(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="partner">Delivery Partner</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button variant="hero" onClick={() => promote.mutate()} disabled={promote.isPending}>
            <UserPlus className="w-4 h-4" /> Promote
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">User must already be registered. Use the partner application form for full onboarding (vehicle, docs).</p>
      </div>

      <div className="bg-card rounded-2xl shadow-soft p-5 sm:p-6 space-y-3">
        <h2 className="font-display font-bold text-brown text-lg">Current staff</h2>
        {staff.isLoading && <Skeleton className="h-32 rounded-xl" />}
        {staff.data && staff.data.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">No staff yet.</p>
        )}
        <div className="space-y-2">
          {(staff.data ?? []).map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <div className={`w-9 h-9 rounded-full grid place-items-center ${r.role === "admin" ? "bg-brown text-primary" : "bg-primary/15 text-brown"}`}>
                {r.role === "admin" ? <ShieldCheck className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-brown truncate">{r.profile?.full_name || r.profile?.email || r.profile?.phone || r.user_id}</div>
                <div className="text-xs text-muted-foreground truncate">{r.profile?.email || r.profile?.phone || ""}</div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-secondary text-brown">{r.role}</span>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Remove ${r.role} role?`)) demote.mutate(r); }}>
                <UserMinus className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminStaff;