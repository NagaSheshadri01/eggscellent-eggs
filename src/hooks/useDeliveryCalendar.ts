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

      const { data: subs, error: subsError } = await supabase
        .from("subscriptions")
        .select(`
          id, 
          status,
          subscription_items ( id, product_slug, quantity, selected_days )
        `)
        .eq("user_id", user.id)
        .eq("status", "active");

      if (subsError) throw subsError;
      if (!subs || subs.length === 0) return [];

      const itemIds = subs.flatMap((s) => s.subscription_items.map((si) => si.id));
      if (itemIds.length === 0) return [];

      const { data: ledger, error: ledgerError } = await (supabase as any)
        .from("subscription_calendar_ledger")
        .select("*, products(name, image_url, price, is_in_stock)")
        .in("subscription_id", subs.map(s => s.id))
        .neq("status", "cancelled")
        .order("delivery_date", { ascending: true });

      if (ledgerError) throw ledgerError;

      const today = new Date();
      const missingEntries = [];
      const existingLedger = ledger || [];

      const { data: products } = await supabase
        .from("products")
        .select("slug, discounted_price");

      for (const sub of subs) {
        for (const item of sub.subscription_items) {
          const days = (item.selected_days as number[] || []).map((d) => Number(d));
          const existingDates = new Set(
            existingLedger
              .filter((l) => l.subscription_item_id === item.id)
              .map((l) => l.delivery_date)
          );

          const matchingProduct = products?.find((p) => p.slug === item.product_slug);
          const rate = matchingProduct?.discounted_price || 0;

          for (let i = 0; i <= 14; i++) {
            const futureDate = new Date();
            futureDate.setDate(today.getDate() + i);
            const currentCheckDayIndex = futureDate.getDay();

            const isScheduledDay = days.includes(currentCheckDayIndex);

            if (isScheduledDay) {
              const dateStr = toDateString(futureDate);
              if (!existingDates.has(dateStr)) {
                missingEntries.push({
                  subscription_item_id: item.id,
                  delivery_date: dateStr,
                  product_slug: item.product_slug,
                  quantity: item.quantity || 1,
                  effective_price: rate,
                  status: "scheduled"
                });
              }
            }
          }
        }
      }

      if (missingEntries.length > 0) {
        const { error: seedError } = await supabase
          .from("subscription_calendar_ledger")
          .upsert(missingEntries, { onConflict: "subscription_item_id, delivery_date, product_slug" });

        if (seedError) {
          console.error("Error seeding calendar:", seedError);
        } else {
          const { data: seededLedger } = await supabase
            .from("subscription_calendar_ledger")
            .select("*, products(name, image_url, price, is_in_stock)")
            .in("subscription_item_id", itemIds)
            .order("delivery_date", { ascending: true });
          
          return seededLedger || [];
        }
      }

      return existingLedger;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`delivery-ledger-status-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "subscription_calendar_ledger",
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

  const toggleSkip = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "scheduled" | "skipped" }) => {
      const { error } = await supabase
        .from("subscription_calendar_ledger")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-ledger"] });
      query.refetch();
      toast.success("Delivery preference updated successfully!");
    },
    onError: (err: Error) => {
      toast.error("Failed to update delivery preference: " + err.message);
    },
  });

  const updateVolume = useMutation({
    mutationFn: async ({ id, quantity, subscription_item_id, delivery_date, product_slug, effective_price }: {id?: string; quantity: number; subscription_item_id?: string; delivery_date?: string; product_slug?: string; effective_price?: number}) => {
      const status = quantity <= 0 ? "skipped" : "scheduled";
      
      if (id) {
        const { error } = await supabase
          .from("subscription_calendar_ledger")
          .update({ quantity, status })
          .eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("subscription_calendar_ledger")
          .upsert([{
            subscription_item_id,
            delivery_date,
            product_slug,
            quantity,
            effective_price,
            status
          }], { onConflict: "subscription_item_id, delivery_date, product_slug" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["delivery-ledger"] });
      query.refetch();
    },
    onError: (err: Error) => {
      toast.error("Failed to update volume: " + err.message);
    }
  });

  const addStandaloneItem = useMutation({
    mutationFn: async ({ date, product_slug, price }: { date: string, product_slug: string, price: number }) => {
      if (!user) throw new Error("No user");
      
      const { data: subs } = await supabase
        .from("subscriptions")
        .select("id, subscription_items(id)")
        .eq("user_id", user.id)
        .eq("status", "active")
        .limit(1)
        .maybeSingle();

      if (!subs?.id || !subs.subscription_items || subs.subscription_items.length === 0) {
        throw new Error("Need an active subscription to add standalone items");
      }

      const { error } = await supabase
        .from("subscription_calendar_ledger")
        .upsert([{
          subscription_item_id: subs.subscription_items?.[0]?.id || null,
          delivery_date: date,
          product_slug,
          quantity: 1,
          effective_price: price,
          status: 'scheduled'
        }], { onConflict: "subscription_item_id, delivery_date, product_slug" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Add-on added to delivery schedule!");
      queryClient.invalidateQueries({ queryKey: ["delivery-ledger"] });
      query.refetch();
    },
    onError: (err: Error) => toast.error(err.message)
  });

  return {
    ...query,
    toggleSkip,
    updateVolume,
    addStandaloneItem
  };
};
