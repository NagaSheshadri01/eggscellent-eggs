import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";

const RequireAuth = ({
  children,
  adminOnly = false,
  partnerOnly = false,
}: { children: ReactNode; adminOnly?: boolean; partnerOnly?: boolean }) => {
  const { user, loading, roleLoading, isAdmin } = useAuth();
  const partnerQ = usePartnerStatus();
  const loc = useLocation();
  const partnerLoading = partnerOnly && partnerQ.isLoading;

  const denied =
    !!user &&
    ((adminOnly && !roleLoading && !isAdmin) ||
      (partnerOnly && !partnerLoading && !partnerQ.data?.isPartner));

  useEffect(() => {
    if (denied) {
      toast.error("You don't have access to that area.");
    }
  }, [denied]);

  if (loading || (adminOnly && roleLoading) || partnerLoading)
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (denied) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default RequireAuth;
