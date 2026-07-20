import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDriverShift = (partnerId?: string, todayStr?: string) => {
  const queryClient = useQueryClient();

  const updateStopStatus = useMutation({
    mutationFn: async ({ stopId, type, status }: { stopId: string; type: 'instant' | 'subscription'; status: "delivered" | "skipped" | "failed" }) => {
      if (type === 'subscription') {
        const { error } = await (supabase as any).rpc('partner_update_drop_status', {
          p_drop_id: stopId,
          p_new_status: status
        });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('one_time_orders')
          .update({ status })
          .eq("id", stopId);
        if (error) throw error;
      }
      return { stopId, type, status };
    },
    onSuccess: (data) => {
      // Invalidate the partner deliveries query for background synchronization
      queryClient.invalidateQueries({ queryKey: ["driver-active-shift"] });
      queryClient.invalidateQueries({ queryKey: ["partner_orders"] });
    },
    onError: (error) => {
      toast.error("Failed to update shift status: " + error.message);
    }
  });

  return {
    updateStopStatus
  };
};
