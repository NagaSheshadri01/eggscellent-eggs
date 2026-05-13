import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roleLoading: boolean;
  isAdmin: boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const resolveRoleNow = async (uid: string) => {
    setRoleLoading(true);
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", uid)
      .eq("role", "admin")
      .maybeSingle();
    setIsAdmin(!!data);
    setRoleLoading(false);
  };

  const refreshRole = async () => {
    if (session?.user?.id) await resolveRoleNow(session.user.id);
  };

  useEffect(() => {
    let lastUserId: string | null = null;
    let rolesChannel: ReturnType<typeof supabase.channel> | null = null;

    const subscribeRoleChanges = (uid: string) => {
      if (rolesChannel) supabase.removeChannel(rolesChannel);
      rolesChannel = supabase
        .channel(`user_roles_${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` },
          async () => {
            // Refresh JWT so any role-based claims update, then re-resolve role state.
            try { await supabase.auth.refreshSession(); } catch {}
            await resolveRoleNow(uid);
          },
        )
        .subscribe();
    };

    const resolveRole = (uid: string) => {
      setTimeout(() => { resolveRoleNow(uid); subscribeRoleChanges(uid); }, 0);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_evt, sess) => {
      setSession(sess);
      const uid = sess?.user?.id ?? null;
      if (uid && uid !== lastUserId) {
        lastUserId = uid;
        resolveRole(uid);
      } else if (!uid) {
        lastUserId = null;
        setIsAdmin(false);
        setRoleLoading(false);
        if (rolesChannel) { supabase.removeChannel(rolesChannel); rolesChannel = null; }
      }
      setLoading(false);
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      const uid = s?.user?.id ?? null;
      if (uid && uid !== lastUserId) {
        lastUserId = uid;
        resolveRole(uid);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
      if (rolesChannel) supabase.removeChannel(rolesChannel);
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, roleLoading, isAdmin, refreshRole, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
