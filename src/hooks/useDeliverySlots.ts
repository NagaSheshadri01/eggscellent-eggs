import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliverySlot = {
  id: string;
  label: string;
  start_time: string;
  end_time: string;
  active: boolean;
  display_order: number;
  slot_key: string;
  tag?: string | null;
};

export const useDeliverySlots = (onlyActive = true) =>
  useQuery({
    queryKey: ["delivery_slots", onlyActive],
    queryFn: async () => {
      let q = supabase.from("delivery_slots").select("*").order("display_order");
      if (onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DeliverySlot[];
    },
    staleTime: 10 * 60_000, // 10 min — slot configs are set-and-forget by admin
  });