import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { lazy, Suspense } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { CartProvider } from "@/context/CartContext";
import RequireAuth from "@/components/RequireAuth";
import CartDrawer from "@/components/site/CartDrawer";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Unauthorized from "./pages/Unauthorized";

const Auth = lazy(() => import("./pages/Auth"));
const Account = lazy(() => import("./pages/Account"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetail = lazy(() => import("./pages/OrderDetail"));
const OrderSuccess = lazy(() => import("./pages/OrderSuccess"));
const DeliveryPartner = lazy(() => import("./pages/DeliveryPartner"));
const Partner = lazy(() => import("./pages/Partner"));
const PartnerAccountHistory = lazy(() => import("./pages/PartnerAccountHistory"));
const Profile = lazy(() => import("./pages/Profile"));
const SubscriptionShop = lazy(() => import("./pages/SubscriptionShop"));

const AdminLayout = lazy(() => import("./pages/admin/AdminLayout"));
const Dashboard = lazy(() => import("./pages/admin/Dashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminFaqs = lazy(() => import("./pages/admin/AdminFaqs"));
const AdminContent = lazy(() => import("./pages/admin/AdminContent"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminOffers = lazy(() => import("./pages/admin/AdminOffers"));
const AdminOrderDetail = lazy(() => import("./pages/admin/AdminOrderDetail"));
const AdminCustomerDetail = lazy(() => import("./pages/admin/AdminCustomerDetail"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));
const AdminDeliveryPartners = lazy(() => import("./pages/admin/AdminDeliveryPartners"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminLogistics = lazy(() => import("./pages/admin/AdminLogistics"));
const AdminStaff = lazy(() => import("./pages/admin/AdminStaff"));

const queryClient = new QueryClient();

const Loading = () => <div className="min-h-screen grid place-items-center text-muted-foreground">Loading…</div>;

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <CartProvider>
            <Suspense fallback={<Loading />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/unauthorized" element={<Unauthorized />} />
                <Route path="/account" element={<RequireAuth><Account /></RequireAuth>} />
                <Route path="/account/wallet" element={<RequireAuth><Account defaultTab="wallet" /></RequireAuth>} />
                <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
                <Route path="/subscriptions" element={<SubscriptionShop />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/orders" element={<RequireAuth><Orders /></RequireAuth>} />
                <Route path="/orders/:id" element={<RequireAuth><OrderDetail /></RequireAuth>} />
                <Route path="/order-success/:id" element={<RequireAuth><OrderSuccess /></RequireAuth>} />
                <Route path="/delivery-partner" element={<DeliveryPartner />} />
                <Route path="/partner" element={<RequireAuth partnerOnly><Partner /></RequireAuth>} />
                <Route path="/partner/history" element={<RequireAuth partnerOnly><PartnerAccountHistory /></RequireAuth>} />

                <Route path="/admin" element={<RequireAuth adminOnly><AdminLayout /></RequireAuth>}>
                  <Route index element={<Dashboard />} />
                  <Route path="logistics" element={<AdminLogistics />} />
                  <Route path="orders" element={<AdminOrders />} />
                  <Route path="orders/:id" element={<AdminOrderDetail />} />
                  <Route path="products" element={<AdminProducts />} />
                  <Route path="customers" element={<AdminCustomers />} />
                  <Route path="customers/:id" element={<AdminCustomerDetail />} />
                  <Route path="faqs" element={<AdminFaqs />} />
                  <Route path="content" element={<AdminContent />} />
                  <Route path="coupons" element={<AdminCoupons />} />
                  <Route path="offers" element={<AdminOffers />} />
                  <Route path="settings" element={<AdminSettings />} />
                  <Route path="delivery-partners" element={<AdminDeliveryPartners />} />
                  <Route path="subscriptions" element={<AdminSubscriptions />} />
                  <Route path="staff" element={<AdminStaff />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
            <CartDrawer />
          </CartProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
