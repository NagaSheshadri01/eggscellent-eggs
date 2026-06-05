import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SiteContentMap = Record<string, any>;

export const useSiteContent = () => {
  return useQuery({
    queryKey: ["site_content"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("cms_content").select("key,value");
      if (error) throw error;
      const map: SiteContentMap = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      return map;
    },
    staleTime: 5 * 60_000, 
    refetchOnWindowFocus: false,
    retry: false,
  });
};

export const useSiteSection = <T = any>(key: string, fallback: T): T => {
  const { data } = useSiteContent();
  return (data?.[key] as T) ?? fallback;
};

export const useUpdateSiteSection = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await (supabase as any)
        .from("cms_content")
        .upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["site_content"] }),
  });
};