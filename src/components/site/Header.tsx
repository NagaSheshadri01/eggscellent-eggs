import { MapPin, ShoppingBag, ChevronDown, User, LogOut, Package, Home as HomeIcon, UserCircle, Calendar } from "lucide-react";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Link, useNavigate } from "react-router-dom";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import StaffPortalLink from "@/components/site/StaffPortalLink";

import { useAppSettings } from "@/hooks/useAppSettings";

import { isSyntheticEmail } from "@/lib/services/user.service";

const Header = () => {
  const { count, setOpen } = useCart();
  const { user, signOut, isPartner } = useAuth();
  const nav = useNavigate();
  const { data: settings } = useAppSettings();
  const businessName = settings?.business?.business_name || "Eggscellent";

  const displayId = isSyntheticEmail(user?.email)
    ? (user?.phone || user?.user_metadata?.phone || "")
    : (user?.email || user?.phone || "");

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-background/75 border-b border-border/60 supports-[backdrop-filter]:bg-background/60">
      <div className="container flex items-center justify-between h-[68px]">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-full gradient-yolk grid place-items-center shadow-yolk group-hover:rotate-12 transition-smooth">
            <span className="text-brown font-display font-bold text-lg">{businessName.charAt(0).toLowerCase()}</span>
          </div>
          <span className="font-display font-bold text-brown text-xl tracking-tight">{businessName}</span>
        </Link>

        <button className="hidden sm:flex items-center gap-1.5 text-sm text-brown/80 hover:text-brown transition-smooth">
          <MapPin className="w-4 h-4 text-primary" />
          <span className="font-medium">Deliver to</span>
          <span className="font-semibold">Bandra W, 400050</span>
          <ChevronDown className="w-4 h-4" />
        </button>

        <div className="hidden md:flex items-center">
          <Link to="/subscriptions" className="text-sm font-semibold hover:text-brown transition-smooth flex items-center gap-1.5 bg-primary/10 px-3.5 py-1.5 rounded-full border border-primary/20 text-brown">
            <span className="text-primary font-bold">⭐</span> Subscribe & Save
          </Link>
        </div>

        <div className="flex items-center gap-1">
          <StaffPortalLink />
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-11 w-11 rounded-full hover:bg-secondary">
                  <User className="w-5 h-5 text-brown" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">{displayId}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => nav("/profile")}><UserCircle className="w-4 h-4 mr-2" /> Profile</DropdownMenuItem>
                {isPartner && (
                  <DropdownMenuItem onClick={() => nav("/partner/history")}><Package className="w-4 h-4 mr-2" /> Delivery History</DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => nav("/account?tab=orders")}><Package className="w-4 h-4 mr-2" /> Recent orders</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav("/account?tab=subscriptions")}><Calendar className="w-4 h-4 mr-2" /> My Subscriptions</DropdownMenuItem>
                <DropdownMenuItem onClick={() => nav("/account?tab=addresses")}><HomeIcon className="w-4 h-4 mr-2" /> Saved addresses</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}><LogOut className="w-4 h-4 mr-2" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button variant="ghost" size="sm" className="rounded-full font-semibold text-brown" onClick={() => nav("/auth")}>Sign in</Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="relative h-11 w-11 rounded-full hover:bg-secondary"
            onClick={() => setOpen(true)}
            aria-label="Open cart"
          >
            <ShoppingBag className="w-5 h-5 text-brown" />
            {count > 0 && (
              <span className="absolute -top-0.5 -right-0.5 bg-brown text-primary text-[11px] font-bold rounded-full min-w-[20px] h-5 grid place-items-center px-1 animate-bounce-in">
                {count}
              </span>
            )}
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
