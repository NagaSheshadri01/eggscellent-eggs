import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

const toDateString = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
};

export const useDeliveryCalendar = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["delivery-ledger", user?.id],
    queryFn: async () => {
      if (!user) return [];

      // 1. Fetch user's active subscriptions
      const { data: subs, error: subsError } = await (supabase as any)
        .from("subscriptions")
        .select("id, product_slug, selected_days, quantity")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (subsError) throw subsError;
      if (!subs || subs.length === 0) return [];

      // 2. Fetch existing ledger entries for these subscriptions
      const { data: ledger, error: ledgerError } = await (supabase as any)
        .from("delivery_ledger")
        .select("*")
        .in("subscription_id", subs.map((s: any) => s.id))
        .order("delivery_date", { ascending: true });

      if (ledgerError) throw ledgerError;

      // 3. Find if any upcoming dates for the next 14 days are missing
      const today = new Date();
      const missingEntries: any[] = [];
      const existingLedger = ledger || [];

      // Load products to fetch pricing rates
      const { data: products } = await (supabase as any)
        .from("products")
        .select("slug, discounted_price");

      for (const sub of subs) {
        const days = sub.selected_days || [];
        const existingDates = new Set(
          existingLedger
            .filter((l: any) => l.subscription_id === sub.id)
            .map((l: any) => l.delivery_date)
        );

        const matchingProduct = products?.find((p: any) => p.slug === sub.product_slug);
        const rate = matchingProduct?.discounted_price || 0;

        for (let i = 0; i <= 14; i++) {
          const date = new Date();
          date.setDate(today.getDate() + i);
          const dayOfWeek = date.getDay(); // 0 = Sunday, 1 = Monday, etc.

          if (days.includes(dayOfWeek)) {
            const dateStr = toDateString(date);
            if (!existingDates.has(dateStr)) {
              missingEntries.push({
                subscription_id: sub.id,
                delivery_date: dateStr,
                product_slug: sub.product_slug,
                quantity: sub.quantity || 1,
                effective_price: rate,
                status: "scheduled",
              });
            }
          }
        }
      }

      // 4. Seed missing entries if any exist
      if (missingEntries.length > 0) {
        const { error: seedError } = await (supabase as any)
          .from("delivery_ledger")
          .insert(missingEntries);

        if (seedError) {
          console.error("Error seeding calendar:", seedError);
        } else {
          // Refetch to return the fully seeded ledger
          const { data: seededLedger } = await (supabase as any)
            .from("delivery_ledger")
            .select("*")
            .in("subscription_id", subs.map((s: any) => s.id))
            .order("delivery_date", { ascending: true });
          
          return seededLedger || [];
        }
      }

      return existingLedger;
    },
    enabled: !!user,
  });

  // Toggle Mutation between 'scheduled' and 'skipped'
  const toggleSkip = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "scheduled" | "skipped" }) => {
      const { error } = await (supabase as any)
        .from("delivery_ledger")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-ledger"] });
      query.refetch();
      toast.success("Delivery preference updated successfully!");
    },
    onError: (err: any) => {
      toast.error("Failed to update delivery preference: " + err.message);
    },
  });

  const updateVolume = useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: number }) => {
      const status = quantity <= 0 ? "skipped" : "scheduled";
      const { error } = await (supabase as any)
        .from("delivery_ledger")
        .update({ quantity, status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-ledger"] });
      query.refetch();
    },
    onError: (err: any) => {
      toast.error("Failed to update volume: " + err.message);
    }
  });

  const addStandaloneItem = useMutation({
    mutationFn: async ({ date, product_slug, price }: { date: string, product_slug: string, price: number }) => {
      if (!user) throw new Error("No user");
      
      const { data: subs } = await (supabase as any)
        .from("subscriptions")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!subs?.id) throw new Error("Need an active subscription to add standalone items");

      const { error } = await (supabase as any)
        .from("delivery_ledger")
        .insert([{
          subscription_id: subs.id,
          delivery_date: date,
          product_slug,
          quantity: 1,
          effective_price: price,
          status: 'scheduled'
        }]);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Add-on added to delivery schedule!");
      queryClient.invalidateQueries({ queryKey: ["delivery-ledger"] });
      query.refetch();
    },
    onError: (err: any) => toast.error(err.message)
  });

  return {
    ...query,
    toggleSkip,
    updateVolume,
    addStandaloneItem
  };
};
