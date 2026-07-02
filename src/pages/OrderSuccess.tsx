import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Package, Truck, Home } from "lucide-react";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";

export default function OrderSuccess() {
  const { id } = useParams();
  const [status, setStatus] = useState<string>("placed");
  const [customOrderId, setCustomOrderId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!id) return;

    // Initial fetch
    (supabase as any).from("one_time_orders").select("status, display_id").eq("id", id).maybeSingle().then(({ data }: any) => {
      if (data) {
        setStatus(data.status);
        setCustomOrderId(data.display_id);
      }
      setLoaded(true);
    });

    // Real-time listener
    const isSubscription = id.startsWith("sub_") || (customOrderId && !customOrderId.startsWith("O"));
    const targetTable = isSubscription ? "subscription_deliveries" : "one_time_orders";

    const channel = supabase.channel(`order-live-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: targetTable as any, filter: `id=eq.${id}` },
        (payload) => { setStatus(payload.new.status); }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [id, customOrderId]);

  if (!loaded) return <div className="min-h-screen bg-background"><Header /></div>;

  const steps = [
    { key: "placed", label: "Order Placed", icon: CheckCircle2 },
    { key: "confirmed", label: "Confirmed", icon: Package },
    { key: "out_for_delivery", label: "Out for Delivery", icon: Truck },
    { key: "delivered", label: "Delivered", icon: Home },
  ];

  const currentIdx = Math.max(0, steps.findIndex(s => s.key === (status === 'pending' ? 'placed' : status)));

  const isCancelled = status === "cancelled";
  const isRefunded = status === "refunded";

  return (
    <div className="min-h-screen bg-background">
      <Seo title="Order Success — Eggscellent" />
      <Header />
      <main className="container max-w-xl py-16">
        <div className="text-center mb-10">
          <div className="w-16 h-16 bg-success/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-success" />
          </div>
          <h1 className="font-display font-bold text-brown text-3xl mb-2">Order successful! test case </h1>
          <p className="text-muted-foreground text-sm">Your order #{customOrderId || id?.split("-")[0]} has been placed successfully.</p>
        </div>

        <div className="bg-card rounded-3xl shadow-soft p-6 mb-8">
          <h2 className="font-display font-semibold text-brown text-lg mb-6">Live Status</h2>
          {isCancelled ? (
            <div className="p-4 mb-6 text-center rounded-xl bg-red-50 border border-red-100 text-red-700 animate-fade-in">
              <p className="font-bold text-base">This order has been Cancelled</p>
              <p className="text-xs text-red-500 mt-1">If money was deducted, your refund will be processed automatically.</p>
            </div>
          ) : isRefunded ? (
            <div className="p-4 mb-6 text-center rounded-xl bg-blue-50 border border-blue-100 text-blue-700 animate-fade-in">
              <p className="font-bold text-base">Order Fully Refunded</p>
              <p className="text-xs text-blue-500 mt-1">Funds have been successfully credited back to your wallet.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {steps.map((step, idx) => {
                const Icon = step.icon;
                const isActive = idx <= currentIdx;
                const isCurrent = idx === currentIdx;

                return (
                  <div key={step.key} className="flex gap-4">
                    <div className="relative flex flex-col items-center">
                      <div className={`w-10 h-10 rounded-full grid place-items-center z-10 transition-smooth ${isActive ? "bg-primary text-brown" : "bg-secondary text-muted-foreground"
                        }`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      {idx < steps.length - 1 && (
                        <div className={`absolute top-10 bottom-[-24px] w-0.5 ${idx < currentIdx ? "bg-primary" : "bg-secondary"
                          }`} />
                      )}
                    </div>
                    <div className={`pt-2 ${isActive ? "text-brown font-semibold" : "text-muted-foreground"}`}>
                      {step.label}
                      {isCurrent && <span className="ml-2 text-xs font-normal text-primary bg-primary/10 px-2 py-0.5 rounded-full animate-pulse">Current</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="text-center">
          <Link to="/" className="text-sm font-semibold text-brown hover:underline">← Back to home</Link>
        </div>
      </main>
    </div>
  );
}
