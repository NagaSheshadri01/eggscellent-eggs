import { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
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

  if (loading || (adminOnly && roleLoading) || partnerLoading)
    return <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/unauthorized" replace />;
  if (partnerOnly && !partnerQ.data?.isPartner) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
};

export default RequireAuth;
