import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import OrdersList from "@/components/site/OrdersList";

const Orders = () => (
  <div className="min-h-screen bg-background">
    <Seo title="My orders — Eggscellent" />
    <Header />
    <main className="container max-w-2xl py-10">
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">My orders</h1>
      <OrdersList />
    </main>
  </div>
);

export default Orders;
