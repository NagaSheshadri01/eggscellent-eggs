import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliverySettings = {
  delivery_fee: number;
  free_delivery_threshold: number;
  minimum_order_amount: number;
  max_delivery_radius_km: number;
  delivery_enabled: boolean;
  delivery_start_time: string;
  delivery_end_time: string;
};

export type BusinessSettings = {
  business_name: string;
  support_phone: string;
  support_email: string;
  whatsapp_number: string;
};

export type AnnouncementSettings = {
  enabled: boolean;
  text: string;
  background_color?: string;
  text_color?: string;
  link?: string;
};

export const DEFAULT_DELIVERY: DeliverySettings = {
  delivery_fee: 29,
  free_delivery_threshold: 199,
  minimum_order_amount: 99,
  max_delivery_radius_km: 15,
  delivery_enabled: true,
  delivery_start_time: "06:00",
  delivery_end_time: "20:00",
};

export const DEFAULT_BUSINESS: BusinessSettings = {
  business_name: "Eggscellent",
  support_phone: "",
  support_email: "",
  whatsapp_number: "",
};

export const useAppSettings = () => {
  return useQuery({
    queryKey: ["app_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("key,value");
      if (error) throw error;
      const map: Record<string, any> = {};
      (data ?? []).forEach((r: any) => { map[r.key] = r.value; });
      return {
        delivery: { ...DEFAULT_DELIVERY, ...(map.delivery || {}) } as DeliverySettings,
        business: { ...DEFAULT_BUSINESS, ...(map.business || {}) } as BusinessSettings,
        announcement: (map.announcement || { enabled: false, text: "" }) as AnnouncementSettings,
      };
    },
    staleTime: 30_000,
  });
};

export const useUpdateAppSetting = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: any }) => {
      const { error } = await supabase.from("app_settings").upsert({ key, value }, { onConflict: "key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["app_settings"] }),
  });
};