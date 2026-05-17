import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubFrequency = "daily" | "alternate" | "weekly";

export type SubscriptionPlan = {
  id: string;
  title: string;
  description: string | null;
  product_slug: string;
  quantity: number;
  frequency_type: "daily" | "alternate" | "weekly" | "custom_days";
  price_per_delivery: number;
  is_active: boolean;
};

// Default discount per frequency when no DB plan exists for a product.
export const DEFAULT_FREQ_DISCOUNT: Record<SubFrequency, number> = {
  daily: 15,
  alternate: 12,
  weekly: 8,
};

export const FREQUENCY_META: Record<SubFrequency, { label: string; perMonth: number }> = {
  daily: { label: "Daily", perMonth: 30 },
  alternate: { label: "Alternate days", perMonth: 15 },
  weekly: { label: "Weekly", perMonth: 4 },
};

export const useSubscriptionPlans = () =>
  useQuery({
    queryKey: ["subscription_plans_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, title, description, product_slug, quantity, frequency_type, custom_days, price_per_delivery, is_active")
        .eq("is_active", true);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    staleTime: 60_000,
  });

export const computeDiscountedPrice = (basePrice: number, freq: SubFrequency, plan?: any) => {
  if (plan && plan.price_per_delivery !== undefined) {
    return Number(plan.price_per_delivery);
  }
  const pct = DEFAULT_FREQ_DISCOUNT[freq] || 10;
  return Math.round(basePrice * (1 - pct / 100));
};
