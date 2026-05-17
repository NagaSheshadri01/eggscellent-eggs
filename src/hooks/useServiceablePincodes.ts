import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Pincode = { id: string; pincode: string; area_name: string | null; active: boolean; delivery_fee_override: number | null; };

export const usePincodes = () =>
  useQuery({
    queryKey: ["pincodes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("serviceable_pincodes").select("*").order("pincode");
      if (error) throw error;
      return (data ?? []) as Pincode[];
    },
    staleTime: 10 * 60_000, // 10 min — pincodes change only when admin edits them
  });

export const useIsPincodeServiceable = (pincode?: string) =>
  useQuery({
    queryKey: ["pincode-check", pincode],
    enabled: !!pincode && /^\d{6}$/.test(pincode),
    queryFn: async () => {
      const { data } = await supabase.from("serviceable_pincodes").select("*").eq("pincode", pincode!).eq("active", true).maybeSingle();
      return data as Pincode | null;
    },
    staleTime: 5 * 60_000, // 5 min — per-pincode check, still slow-changing
  });

export const useUpsertPincode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<Pincode> & { pincode: string }) => {
      const { error } = await supabase.from("serviceable_pincodes").upsert(row as any, { onConflict: "pincode" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pincodes"] }),
  });
};

export const useDeletePincode = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("serviceable_pincodes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pincodes"] }),
  });
};