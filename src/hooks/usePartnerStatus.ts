import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export const usePartnerStatus = () => {
  const { user } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`partner_status_${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_partners", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["partner_status", user.id] }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["partner_status", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return useQuery({
    queryKey: ["partner_status", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const [{ data: dp, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("delivery_partners").select("id, status, active").eq("user_id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "partner"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const approvedPartner = !!dp && dp.active && dp.status === "approved";
      const hasPartnerRole = (roles ?? []).length > 0;
      return { partner: dp, isPartner: approvedPartner || hasPartnerRole };
    },
  });
};
