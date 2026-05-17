import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const useFaqs = (opts?: { onlyActive?: boolean }) => {
  return useQuery({
    queryKey: ["faqs", opts?.onlyActive ? "active" : "all"],
    queryFn: async () => {
      let q = supabase.from("faq").select("*").order("display_order");
      if (opts?.onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60_000, // 10 min — FAQs are editorial, rarely change
  });
};

export const useInvalidateFaqs = () => {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["faqs"] });
};