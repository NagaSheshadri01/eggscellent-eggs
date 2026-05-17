import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, Truck, UserMinus, UserPlus, Mail, Phone, Calendar, Info } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type RoleRow = { id: string; user_id: string; role: "admin" | "partner" | "customer"; profile?: { full_name: string | null; email: string | null; phone: string | null } | null };

const useStaff = () =>
  useQuery({
    queryKey: ["staff_roles"],
    queryFn: async () => {
      const [rolesRes, partnersRes] = await Promise.all([
        supabase.from("user_roles").select("id, user_id, role").eq("role", "admin"),
        supabase.from("delivery_partners").select("*").eq("status", "approved").eq("active", true)
      ]);
      if (rolesRes.error) throw rolesRes.error;
      if (partnersRes.error) throw partnersRes.error;
      
      const adminRoles = (rolesRes.data ?? []).map(r => ({ id: r.id, user_id: r.user_id, role: "admin" as const }));
      const partnerRoles = (partnersRes.data ?? []).filter(p => p.user_id).map(p => ({ id: p.id, user_id: p.user_id!, role: "partner" as const }));
      
      const combined = [...adminRoles, ...partnerRoles];
      const ids = Array.from(new Set(combined.map((r) => r.user_id)));
      
      const { data: profs } = ids.length
        ? await supabase.from("profiles").select("id, full_name, email, phone").in("id", ids)
        : { data: [] as any[] };
      const byId = new Map((profs ?? []).map((p: any) => [p.id, p]));
      const partnerData = new Map((partnersRes.data ?? []).filter(p => p.user_id).map((p: any) => [p.user_id, p]));
      
      return combined.map((r) => ({ 
        ...r, 
        profile: byId.get(r.user_id) ?? null,
        partnerDetails: partnerData.get(r.user_id) ?? null
      })) as any[];
    },
  });

const AdminStaff = () => {
  const qc = useQueryClient();
  const staff = useStaff();
  const { refreshRole } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [partnerName, setPartnerName] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [role, setRole] = useState<"admin" | "partner">("admin");
  const [selectedStaff, setSelectedStaff] = useState<any | null>(null);

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
      if (role === "admin") {
        const { error: insErr } = await supabase
          .from("user_roles")
          .upsert({ user_id: prof.id, role: "admin" as any }, { onConflict: "user_id" });
        if (insErr) {
          console.error("ADMIN PROMOTION FAILED:", insErr.message);
          throw insErr;
        }
      } else if (role === "partner") {
        // HARD INSERT: We must ensure this record exists in the DB disk before continuing
        const { error: dpErr } = await supabase
          .from("delivery_partners")
          .insert({ 
            user_id: prof.id, 
            full_name: partnerName || prof.full_name || "Partner",
            phone: prof.phone || "",
            email: prof.email,
            notes: altPhone ? `Alt Phone: ${altPhone}` : null,
            status: "approved", 
            active: true 
          });
        
        if (dpErr) {
          console.error("PARTNER DB COMMIT FAILED:", dpErr.message);
          // If it fails because of duplicate, we try upsert as fallback
          if (dpErr.code === "23505") {
            const { error: upErr } = await supabase.from("delivery_partners").upsert({
               user_id: prof.id, 
               full_name: partnerName || prof.full_name || "Partner", 
               phone: prof.phone || "",
               active: true, 
               status: "approved"
            }, { onConflict: "user_id" });
            if (upErr) throw upErr;
          } else {
            throw dpErr;
          }
        }

        // Assign the role in the permissions table
        const { error: roleErr } = await supabase
          .from("user_roles")
          .upsert({ user_id: prof.id, role: "partner" as any }, { onConflict: "user_id" });
        
        if (roleErr) throw roleErr;
      }
      return prof;
    },
    onSuccess: async (prof) => {
      toast.success(`${partnerName || prof.full_name || prof.phone} successfully committed as ${role}!`);
      setIdentifier("");
      setPartnerName("");
      setAltPhone("");
      await qc.invalidateQueries({ queryKey: ["staff_roles"] });
      await qc.invalidateQueries({ queryKey: ["partners_active"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const demote = useMutation({
    mutationFn: async (row: RoleRow) => {
      if (row.role === "admin") {
        const { error } = await supabase.from("user_roles").delete().eq("id", row.id);
        if (error) throw error;
      } else if (row.role === "partner") {
        const { error } = await supabase.from("delivery_partners").update({ active: false, status: "rejected" }).eq("id", row.id);
        if (error) throw error;
      }
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
        <div className="grid sm:grid-cols-2 lg:grid-cols-[1.5fr_1.5fr_1.5fr_1fr_auto] gap-4 items-end">
          <div>
            <Label className="text-xs">Display Name</Label>
            <Input value={partnerName} onChange={(e) => setPartnerName(e.target.value)} placeholder="Full Name" />
          </div>
          <div>
            <Label className="text-xs">Primary Phone (Login ID)</Label>
            <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
          </div>
          <div>
            <Label className="text-xs">Alt Phone (Optional)</Label>
            <Input value={altPhone} onChange={(e) => setAltPhone(e.target.value)} placeholder="Secondary Number" />
          </div>
          <div>
            <Label className="text-xs">Target Role</Label>
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
          {(staff.data ?? []).map((r) => {
            const adminGivenName = r.partnerDetails?.full_name;
            const selfName = r.profile?.full_name;
            const displayName = r.role === 'partner' ? (adminGivenName || selfName) : selfName;
            return (
            <div key={r.id} className="flex items-center gap-3 p-3 rounded-xl border border-border cursor-pointer hover:bg-secondary/30 transition-colors group" onClick={() => setSelectedStaff(r)}>
              <div className={`w-9 h-9 rounded-full grid place-items-center ${r.role === "admin" ? "bg-brown text-primary" : "bg-primary/15 text-brown"}`}>
                {r.role === "admin" ? <ShieldCheck className="w-4 h-4" /> : <Truck className="w-4 h-4" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-brown truncate group-hover:text-primary transition-colors">
                  {displayName || "Staff Member"}
                  {r.role === 'partner' && adminGivenName && selfName && adminGivenName !== selfName && (
                    <span className="ml-2 text-[10px] font-normal text-muted-foreground">(self: {selfName})</span>
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">{r.profile?.phone || r.profile?.email || "No contact"}</div>
              </div>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-secondary text-brown">{r.role}</span>
              <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); if (confirm(`Remove ${r.role} role?`)) demote.mutate(r); }}>
                <UserMinus className="w-4 h-4" />
              </Button>
            </div>
          );})}
        </div>
      </div>

      <Dialog open={!!selectedStaff} onOpenChange={() => setSelectedStaff(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="w-5 h-5 text-primary" /> Staff Profile
            </DialogTitle>
          </DialogHeader>
          {selectedStaff && (
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4">
                <div className={`w-16 h-16 rounded-2xl grid place-items-center ${selectedStaff.role === "admin" ? "bg-brown text-primary" : "bg-primary/15 text-brown"}`}>
                  {selectedStaff.role === "admin" ? <ShieldCheck className="w-8 h-8" /> : <Truck className="w-8 h-8" />}
                </div>
              <div>
                <h3 className="font-display font-bold text-brown text-xl">
                  {selectedStaff.role === 'partner' 
                    ? (selectedStaff.partnerDetails?.full_name || selectedStaff.profile?.full_name || "Unnamed") 
                    : (selectedStaff.profile?.full_name || "Unnamed Staff")}
                </h3>
                <span className="text-xs uppercase font-bold tracking-widest px-2 py-0.5 rounded bg-secondary text-brown">{selectedStaff.role}</span>
              </div>
              </div>

              <div className="grid gap-4">
                {selectedStaff.role === 'partner' && (
                  <div className="rounded-xl bg-secondary/40 p-4 space-y-2 border border-border/50">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mb-3">Name Records</p>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Admin-given name</span>
                      <span className="font-bold text-brown">{selectedStaff.partnerDetails?.full_name || "—"}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-muted-foreground">Self-registered name</span>
                      <span className="font-semibold text-brown">{selectedStaff.profile?.full_name || "—"}</span>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-brown">{selectedStaff.profile?.email || "No email linked"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-brown font-mono">{selectedStaff.profile?.phone || "No phone linked"}</span>
                </div>
                {selectedStaff.partnerDetails?.notes && (
                  <div className="flex items-center gap-3 text-sm">
                    <Phone className="w-4 h-4 text-primary" />
                    <span className="text-brown font-mono">{selectedStaff.partnerDetails.notes}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground">Joined {new Date(selectedStaff.partnerDetails?.created_at || Date.now()).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                </div>
              </div>

              <div className="pt-4 border-t flex justify-end">
                <Button variant="outline" onClick={() => setSelectedStaff(null)}>Close</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminStaff;