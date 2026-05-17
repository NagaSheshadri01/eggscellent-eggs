import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Coupon = {
  id: string;
  code: string;
  discount_type: "percent" | "flat";
  discount_value: number;
  min_order_amount: number;
  usage_limit?: number;
  active: boolean;
  expiry?: string | null;
  description?: string | null;
};

export const useCoupons = (opts?: { onlyActive?: boolean }) => {
  return useQuery({
    queryKey: ["coupons", opts?.onlyActive ? "active" : "all"],
    queryFn: async () => {
      let q = supabase.from("coupons").select("*").order("created_at", { ascending: false });
      if (opts?.onlyActive) q = q.eq("active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Coupon[];
    },
  });
};
