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
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  return useQuery({
    queryKey: ["partner_status", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("delivery_partners")
        .select("id, status, active")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      const isPartner = !!data && data.active && data.status === "approved";
      return { partner: data, isPartner };
    },
  });
};