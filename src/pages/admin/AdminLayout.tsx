import { NavLink, Outlet, Link } from "react-router-dom";
import { LayoutDashboard, Package, ShoppingBag, Users, HelpCircle, FileText, Tag, ArrowLeft, Settings, Truck, Repeat, ShieldCheck, Sparkles } from "lucide-react";
import Seo from "@/components/Seo";

const items = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/customers", label: "Customers", icon: Users },
  { to: "/admin/subscriptions", label: "Subscription Orders", icon: Repeat },
  { to: "/admin/delivery-partners", label: "Partners", icon: Truck },
  { to: "/admin/staff", label: "Staff & roles", icon: ShieldCheck },
  { to: "/admin/coupons", label: "Coupons", icon: Tag },
  { to: "/admin/offers", label: "Offers", icon: Sparkles },
  { to: "/admin/faqs", label: "FAQs", icon: HelpCircle },
  { to: "/admin/content", label: "Content", icon: FileText },
  { to: "/admin/settings", label: "Settings", icon: Settings },
];

const AdminLayout = () => (
  <div className="min-h-screen bg-secondary/30 flex w-full">
    <Seo title="Admin — Eggscellent" />
    <aside className="w-60 shrink-0 hidden md:flex flex-col bg-card border-r border-border p-4">
      <Link to="/" className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 rounded-full gradient-yolk grid place-items-center"><span className="text-brown font-display font-bold text-sm">e</span></div>
        <span className="font-display font-bold text-brown">Admin</span>
      </Link>
      <nav className="space-y-1">
        {items.map(it => (
          <NavLink key={it.to} to={it.to} end={(it as any).end} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-smooth ${isActive ? "bg-primary/10 text-brown" : "text-muted-foreground hover:bg-secondary hover:text-brown"}`}>
            <it.icon className="w-4 h-4" /> {it.label}
          </NavLink>
        ))}
      </nav>
      <Link to="/" className="mt-auto flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-brown">
        <ArrowLeft className="w-4 h-4" /> Back to store
      </Link>
    </aside>
    <main className="flex-1 min-w-0 p-4 sm:p-8 overflow-x-hidden">
      <Outlet />
    </main>
  </div>
);

export default AdminLayout;
