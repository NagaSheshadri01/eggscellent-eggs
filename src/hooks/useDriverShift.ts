import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDriverShift = (partnerId?: string, todayStr?: string) => {
  const queryClient = useQueryClient();

  const updateStopStatus = useMutation({
    mutationFn: async ({ stopId, type, status }: { stopId: string; type: 'instant' | 'subscription'; status: "delivered" | "skipped" | "failed" }) => {
      const table = type === 'instant' ? 'one_time_orders' : 'subscription_calendar_ledger';
      const { error } = await (supabase as any)
        .from(table)
        .update({ status })
        .eq("id", stopId);

      if (error) throw error;
      return { stopId, type, status };
    },
    onSuccess: (data) => {
      // Invalidate the partner deliveries query for background synchronization
      queryClient.invalidateQueries({ queryKey: ["driver-active-shift"] });
      queryClient.invalidateQueries({ queryKey: ["partner_orders"] });
    },
    onError: (error: any) => {
      toast.error("Failed to update shift status: " + error.message);
    }
  });

  return {
    updateStopStatus
  };
};
