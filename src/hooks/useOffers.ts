import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type OfferType = "product_discount" | "free_delivery" | "product_free" | "bundle_buy";

export type Offer = {
  id: string;
  title: string;
  description: string;
  offer_type: OfferType;
  min_order_value: number;
  required_product_slugs?: string[] | null;
  reward_product_slug?: string | null;
  coupon_code_to_apply?: string | null;
  is_active: boolean;
  created_at?: string;
};

export const useOffers = (opts?: { onlyActive?: boolean }) => {
  return useQuery({
    queryKey: ["offers", opts?.onlyActive ? "active" : "all"],
    queryFn: async () => {
      let q = (supabase as any).from("offers").select("*").order("created_at", { ascending: false });
      if (opts?.onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Offer[];
    },
  });
};
