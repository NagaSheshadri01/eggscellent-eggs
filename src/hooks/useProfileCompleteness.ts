import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

export const useProfileCompleteness = () => {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["profile", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, email, phone, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as ProfileRow | null;
    },
  });

  const profile = q.data ?? null;
  const hasName = !!profile?.full_name?.trim();
  const hasEmail = !!profile?.email?.trim();
  const hasPhone = !!profile?.phone?.trim();
  let missing: "phone" | "email" | "name" | null = null;
  if (profile) {
    if (!hasPhone) missing = "phone";
    else if (!hasEmail) missing = "email";
    else if (!hasName) missing = "name";
  }
  return {
    ...q,
    profile,
    hasName,
    hasEmail,
    hasPhone,
    missing,
    isComplete: !!profile && hasName && hasEmail && hasPhone,
  };
};

export const useInvalidateProfile = () => {
  const qc = useQueryClient();
  const { user } = useAuth();
  return () => qc.invalidateQueries({ queryKey: ["profile", user?.id ?? "anon"] });
};