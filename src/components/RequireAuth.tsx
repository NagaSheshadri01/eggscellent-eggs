import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const RequireAuth = ({
  children,
  adminOnly = false,
  partnerOnly = false,
}: { children: ReactNode; adminOnly?: boolean; partnerOnly?: boolean }) => {
  const { user, loading, roleLoading, isAdmin, isPartner } = useAuth();
  const loc = useLocation();

  const denied =
    !!user &&
    ((adminOnly && !roleLoading && !isAdmin) ||
      (partnerOnly && !roleLoading && !isPartner && !isAdmin));

  useEffect(() => {
    if (denied) {
      toast.error("You don't have access to that area.");
    }
  }, [denied]);

  if (loading || roleLoading)
    return <div className="flex h-screen w-screen items-center justify-center bg-stone-50 font-medium text-stone-600">Loading your profile securely...</div>;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (partnerOnly && !isPartner && !isAdmin && !loading) return <Navigate to="/auth" replace />;
  if (denied) return <Navigate to="/" replace />;
  return <>{children}</>;
};

export default RequireAuth;
