import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { userService } from "@/lib/services/user.service";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type AuthCtx = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  roleLoading: boolean;
  isAdmin: boolean;
  isPartner: boolean;
  refreshRole: () => Promise<void>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [roleLoading, setRoleLoading] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isPartner, setIsPartner] = useState(false);
  const queryClient = useQueryClient();

  const resolveRoleNow = useCallback(async (uid: string) => {
    setRoleLoading(true);
    try {
      const [{ data: adminData }, { data: partnerData }] = await Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", uid).eq("role", "admin").maybeSingle(),
        supabase.from("delivery_partners").select("id").eq("user_id", uid).eq("status", "approved").eq("active", true).maybeSingle(),
      ]);
      setIsAdmin(!!adminData);
      setIsPartner(!!partnerData);
    } finally {
      setRoleLoading(false);
      setLoading(false);
    }
  }, []);

  const refreshRole = async () => {
    if (session?.user?.id) await resolveRoleNow(session.user.id);
  };

  useEffect(() => {
    let lastUserId: string | null = null;
    let rolesChannel: ReturnType<typeof supabase.channel> | null = null;
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    const refreshSessionAndRole = async (uid: string) => {
      try { await supabase.auth.refreshSession(); } catch {}
      await resolveRoleNow(uid);
      setSession((current) => current ? { ...current } : current);
    };

    const subscribeUserChanges = (uid: string) => {
      // ① Tear down existing channels before re-subscribing (user switch guard)
      if (rolesChannel) supabase.removeChannel(rolesChannel);
      if (profileChannel) supabase.removeChannel(profileChannel);
      rolesChannel = supabase
        .channel(`user_roles_${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "user_roles", filter: `user_id=eq.${uid}` },
          () => { void refreshSessionAndRole(uid); },
        )
        .subscribe();
      profileChannel = supabase
        .channel(`profiles_${uid}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "profiles", filter: `id=eq.${uid}` },
          () => { void refreshSessionAndRole(uid); },
        )
        .subscribe();
    };

    const resolveRole = (sess: Session) => {
      setTimeout(async () => {
        try { await supabase.auth.refreshSession(); } catch {}
        void userService.ensureProfile(sess.user).catch(() => {});
        await resolveRoleNow(sess.user.id);
        subscribeUserChanges(sess.user.id);
      }, 0);
    };

    const initializeAuth = async () => {
      try {
        const { data: { session: s } } = await supabase.auth.getSession();
        setSession(s);
        const uid = s?.user?.id ?? null;
        if (uid && uid !== lastUserId) {
          lastUserId = uid;
          resolveRole(s!);
        }
      } catch (error) {
        console.error("Error fetching initial session:", error);
      } finally {
        setLoading(false);
      }
    };
    
    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, sess) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        setSession(sess);
        const uid = sess?.user?.id ?? null;
        if (uid && uid !== lastUserId) {
          lastUserId = uid;
          resolveRole(sess!);
        }
        setLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        lastUserId = null;
        setIsAdmin(false);
        setIsPartner(false);
        setRoleLoading(false);
        // ② Tear down on sign-out so channels don't linger after the user logs off
        if (rolesChannel) { supabase.removeChannel(rolesChannel); rolesChannel = null; }
        if (profileChannel) { supabase.removeChannel(profileChannel); profileChannel = null; }
        setLoading(false);
      }
    });

    return () => {
      // ③ Effect-level teardown — fires on unmount or when resolveRoleNow identity changes
      subscription.unsubscribe();
      if (rolesChannel) supabase.removeChannel(rolesChannel);
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, [resolveRoleNow]);

  const signOut = async () => {
    try {
      // 1. Terminate the active Supabase session tokens
      await supabase.auth.signOut();
      
      // 2. Completely wipe out the TanStack / React Query in-memory data cache
      queryClient.clear();
      
      toast.success("Logged out successfully.");
      
      // 3. Force a clean, hard reload-redirect to the home route.
      // This absolutely guarantees that all local component states, custom states, 
      // and layout contexts are cleanly unmounted and reset from scratch.
      window.location.replace('/');
      
    } catch (error) {
      console.error("Error during authentication termination sequence:", error);
      toast.error("Logout failed. Please refresh and try again.");
    }
  };

  return (
    <Ctx.Provider value={{ session, user: session?.user ?? null, loading, roleLoading, isAdmin, isPartner, refreshRole, signOut }}>
      {children}
    </Ctx.Provider>
  );
};

export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth must be inside AuthProvider");
  return c;
};
