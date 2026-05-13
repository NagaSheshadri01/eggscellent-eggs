import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type DeliveryPartner = {
  id: string;
  user_id: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  vehicle_type: string | null;
  city: string | null;
  pincode: string | null;
  availability: any;
  status: "pending" | "approved" | "rejected";
  active: boolean;
  aadhaar_url: string | null;
  license_url: string | null;
  experience_years: number | null;
  assigned_areas: string[];
  assigned_slot_ids: string[];
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const useDeliveryPartners = (status?: string) =>
  useQuery({
    queryKey: ["delivery_partners", status ?? "all"],
    queryFn: async () => {
      let q = supabase.from("delivery_partners").select("*").order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as DeliveryPartner[];
    },
  });

export const useUpdateDeliveryPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DeliveryPartner> }) => {
      const { error } = await supabase.from("delivery_partners").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery_partners"] }),
  });
};

export const useApproveDeliveryPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner: DeliveryPartner) => {
      const { error } = await supabase.from("delivery_partners").update({ status: "approved", active: true }).eq("id", partner.id);
      if (error) throw error;
      if (partner.user_id) {
        await supabase.from("user_roles").insert({ user_id: partner.user_id, role: "partner" as any });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery_partners"] }),
  });
};