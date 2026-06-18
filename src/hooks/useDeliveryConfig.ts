import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryTier = {
  from_km: number;
  to_km: number;
  price: number;
};

export type DeliveryConfig = {
  id: number;
  min_order_value: number;
  store_latitude: number;
  store_longitude: number;
  delivery_tiers: DeliveryTier[];
};

export const useDeliveryConfig = () => {
  return useQuery({
    queryKey: ["global_delivery_config"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("delivery_config") as any).select("*").eq("id", 1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return (data || {
        min_order_value: 150,
        store_latitude: 17.5011,
        store_longitude: 78.5020,
        delivery_tiers: []
      }) as DeliveryConfig;
    },
    staleTime: 5 * 60_000,
  });
};
