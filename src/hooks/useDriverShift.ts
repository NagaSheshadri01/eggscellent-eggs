import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const useDriverShift = (partnerId?: string, todayStr?: string) => {
  const queryClient = useQueryClient();

  const updateStopStatus = useMutation({
    mutationFn: async ({ stopId, status }: { stopId: string; status: "delivered" | "skipped" | "failed" }) => {
      const { error } = await (supabase as any)
        .from("delivery_ledger")
        .update({ status })
        .eq("id", stopId);

      if (error) throw error;
      return { stopId, status };
    },
    onSuccess: (data) => {
      // Invalidate the partner deliveries query for background synchronization
      queryClient.invalidateQueries({ queryKey: ["partner_sub_deliveries", partnerId, todayStr] });
    },
    onError: (error: any) => {
      toast.error("Failed to update shift status: " + error.message);
    }
  });

  return {
    updateStopStatus
  };
};
