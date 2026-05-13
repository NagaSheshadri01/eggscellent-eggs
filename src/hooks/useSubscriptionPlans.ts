import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SubFrequency = "daily" | "alternate" | "weekly";

export type SubscriptionPlan = {
  id: string;
  title: string;
  product_id: string | null;
  frequency: SubFrequency;
  default_quantity: number;
  discount_type: "percent" | "amount" | null;
  discount_value: number;
  popular: boolean;
  active: boolean;
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
    queryKey: ["subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("id, title, product_id, frequency, default_quantity, discount_type, discount_value, popular, active")
        .eq("active", true);
      if (error) throw error;
      return (data ?? []) as SubscriptionPlan[];
    },
    staleTime: 60_000,
  });

export const computeDiscountedPrice = (basePrice: number, freq: SubFrequency, plan?: SubscriptionPlan) => {
  if (plan && plan.discount_type === "amount") {
    return Math.max(0, basePrice - Number(plan.discount_value));
  }
  const pct = plan?.discount_type === "percent" ? Number(plan.discount_value) : DEFAULT_FREQ_DISCOUNT[freq];
  return Math.round(basePrice * (1 - pct / 100));
};
