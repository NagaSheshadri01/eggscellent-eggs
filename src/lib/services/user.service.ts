import { supabase } from "@/integrations/supabase/client";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
};

/** A synthetic placeholder email created by phone-only auth. Never show to users. */
export const SYNTHETIC_EMAIL_RE = /@auth\.eggscellent\.app$/i;
export const isSyntheticEmail = (e?: string | null) => !!e && SYNTHETIC_EMAIL_RE.test(e);

/** Display helper — masks synthetic auth.users.email values. */
export const displayEmail = (e?: string | null) => (isSyntheticEmail(e) ? "" : e || "");

export const userService = {
  async getProfile(userId: string): Promise<ProfileRow | null> {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, phone, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw error;
    return (data ?? null) as ProfileRow | null;
  },

  /** Updates whitelisted profile fields. Phone is intentionally NOT editable here. */
  async updateProfile(
    userId: string,
    patch: Partial<Pick<ProfileRow, "full_name" | "email" | "avatar_url">>,
  ) {
    const clean: { full_name?: string | null; email?: string | null; avatar_url?: string | null } = {};
    if (patch.full_name !== undefined) clean.full_name = patch.full_name?.trim() || null;
    if (patch.email !== undefined) clean.email = patch.email?.trim() || null;
    if (patch.avatar_url !== undefined) clean.avatar_url = patch.avatar_url || null;
    const { error } = await supabase.from("profiles").update(clean).eq("id", userId);
    if (error) throw error;
  },

  async emailExists(email: string) {
    const { data, error } = await supabase.rpc("email_exists", { _email: email });
    if (error) throw error;
    return !!data;
  },
};
