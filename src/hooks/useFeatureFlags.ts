import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type InstantPartner = { name: string; logo_url?: string; deep_link: string };
export type FeatureFlags = {
  instant_delivery_enabled: boolean;
  partners: InstantPartner[];
};

const DEFAULT: FeatureFlags = { instant_delivery_enabled: false, partners: [] };

export const useFeatureFlags = () => {
  const qc = useQueryClient();

  useEffect(() => {
    const ch = supabase
      .channel("app_settings_flags")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "app_settings", filter: "key=eq.feature_flags" },
        () => qc.invalidateQueries({ queryKey: ["feature_flags"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  return useQuery({
    queryKey: ["feature_flags"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("app_settings")
        .select("value")
        .eq("key", "feature_flags")
        .maybeSingle();
      if (error) throw error;
      const v = (data?.value as Partial<FeatureFlags>) ?? {};
      return { ...DEFAULT, ...v, partners: v.partners ?? [] } as FeatureFlags;
    },
    staleTime: 0,
  });
};

export const useUpdateFeatureFlags = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (value: FeatureFlags) => {
      const { error } = await (supabase as any)
        .from("app_settings")
        .upsert({ key: "feature_flags", value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["feature_flags"] }),
  });
};