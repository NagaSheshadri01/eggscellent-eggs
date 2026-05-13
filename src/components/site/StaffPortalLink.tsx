import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { usePartnerStatus } from "@/hooks/usePartnerStatus";

const StaffPortalLink = () => {
  const { isAdmin } = useAuth();
  const { data } = usePartnerStatus();
  const isPartner = data?.isPartner;

  if (!isAdmin && !isPartner) return null;
  const to = isAdmin ? "/admin" : "/partner";
  const label = isAdmin ? "Admin Portal" : "Partner Portal";

  return (
    <Link
      to={to}
      className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brown text-primary text-xs font-semibold hover:opacity-90 transition-smooth"
    >
      <ShieldCheck className="w-3.5 h-3.5" /> {label}
    </Link>
  );
};

export default StaffPortalLink;