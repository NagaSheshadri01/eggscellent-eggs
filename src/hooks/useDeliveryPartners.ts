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
  profile?: any;
};

export const useDeliveryPartners = (status?: string) =>
  useQuery({
    queryKey: ["delivery_partners", status ?? "all"],
    queryFn: async () => {
      let q = (supabase as any).from("delivery_partners").select("*").order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      
      const partners = (data ?? []) as DeliveryPartner[];
      
      // Attempt to join profiles to get the latest avatar/name from auth
      const userIds = partners.map(p => p.user_id).filter(Boolean) as string[];
      if (userIds.length > 0) {
        const { data: profs } = await (supabase as any).from("profiles").select("id, full_name, avatar_url, phone").in("id", userIds);
        const pMap = Object.fromEntries((profs || []).map((p: any) => [p.id, p]));
        return partners.map(p => {
          if (p.user_id && pMap[p.user_id]) {
            return { ...p, profile: pMap[p.user_id] };
          }
          return p;
        });
      }
      return partners;
    },
    staleTime: 2 * 60_000, // 2 min — admin approval mutations always invalidate
  });

export const useUpdateDeliveryPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<DeliveryPartner> }) => {
      const { error } = await (supabase as any).from("delivery_partners").update(patch as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery_partners"] }),
  });
};

export const useApproveDeliveryPartner = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (partner: DeliveryPartner) => {
      const { error } = await (supabase as any).from("delivery_partners").update({ status: "approved", active: true }).eq("id", partner.id);
      if (error) throw error;
      // Removed broken insert into user_roles (partner is not in app_role enum). 
      // AuthContext handles access strictly via delivery_partners status.
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["delivery_partners"] }),
  });
};