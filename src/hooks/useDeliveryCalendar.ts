import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
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

      // 1. Fetch user's active subscriptions and join their plan to get contract pricing rates
      const { data: subs, error: subsError } = await (supabase as any)
        .from("subscriptions")
        .select(`
          id, 
          product_slug, 
          selected_days, 
          quantity,
          subscription_plans:plan_id (
            price_per_delivery
          )
        `)
        .eq("user_id", user.id)
        .eq("status", "active");

      if (subsError) throw subsError;
      if (!subs || subs.length === 0) return [];

      // 2. Fetch existing ledger entries for these subscriptions (exclude cancelled)
      const { data: ledger, error: ledgerError } = await (supabase as any)
        .from("delivery_ledger")
        .select("*")
        .in("subscription_id", subs.map((s: any) => s.id))
        .neq("status", "cancelled")
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
        const days = (sub.selected_days || []).map((d: any) => Number(d));
        const existingDates = new Set(
          existingLedger
            .filter((l: any) => l.subscription_id === sub.id)
            .map((l: any) => l.delivery_date)
        );

        const matchingProduct = products?.find((p: any) => p.slug === sub.product_slug);
        const rate = sub.subscription_plans?.price_per_delivery || matchingProduct?.discounted_price || 0;

        for (let i = 0; i <= 14; i++) {
          const futureDate = new Date();
          futureDate.setDate(today.getDate() + i);
          const currentCheckDayIndex = futureDate.getDay();

          const isScheduledDay = days.includes(currentCheckDayIndex);

          if (isScheduledDay) {
            const dateStr = toDateString(futureDate);
            if (!existingDates.has(dateStr)) {
              missingEntries.push({
                subscription_id: sub.id,
                delivery_date: dateStr,
                product_slug: sub.product_slug,
                quantity: sub.quantity || 1,
                effective_price: rate,
                status: "scheduled"
              });
            }
          }
        }
      }

      // 4. Seed missing entries if any exist
      if (missingEntries.length > 0) {
        const { error: seedError } = await (supabase as any)
          .from("delivery_ledger")
          .upsert(missingEntries, { onConflict: "subscription_id, delivery_date, product_slug" });

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

  // --- REALTIME LISTENER ---
  // Immediately sync user's calendar when admin changes a ledger row status
  // (e.g., marking Out of Stock / Restoring Stock), without requiring page reload.
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`delivery-ledger-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "delivery_ledger",
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["delivery-ledger", user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient]);

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
    mutationFn: async ({ id, quantity, subscription_id, delivery_date, product_slug, effective_price }: any) => {
      const status = quantity <= 0 ? "skipped" : "scheduled";
      
      if (id) {
        const { error } = await (supabase as any)
          .from("delivery_ledger")
          .update({ quantity, status })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("delivery_ledger")
          .upsert([{
            subscription_id,
            delivery_date,
            product_slug,
            quantity,
            effective_price,
            status
          }], { onConflict: "subscription_id, delivery_date, product_slug" });
        if (error) throw error;
      }
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
        .upsert([{
          subscription_id: subs.id,
          delivery_date: date,
          product_slug,
          quantity: 1,
          effective_price: price,
          status: 'scheduled'
        }], { onConflict: "subscription_id, delivery_date, product_slug" });
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
