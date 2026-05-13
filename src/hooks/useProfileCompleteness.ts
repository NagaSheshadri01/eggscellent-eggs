import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { userService, isSyntheticEmail, type ProfileRow } from "@/lib/services/user.service";

export type { ProfileRow };

export const useProfileCompleteness = () => {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["profile", user?.id ?? "anon"],
    enabled: !!user,
    queryFn: () => userService.getProfile(user!.id),
    staleTime: 30_000,
  });

  const profile = q.data ?? null;
  const hasName = !!profile?.full_name?.trim();
  // Synthetic emails (from phone-only auth) don't count.
  const hasEmail = !!profile?.email?.trim() && !isSyntheticEmail(profile.email);
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