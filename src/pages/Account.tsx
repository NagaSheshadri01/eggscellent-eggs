import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import OrdersList from "@/components/site/OrdersList";
import AddressPicker from "@/components/site/AddressPicker";
import AccountSubscriptions from "@/components/site/AccountSubscriptions";
import SubscriptionCalendar from "@/components/account/SubscriptionCalendar";
import { LogOut, Wallet } from "lucide-react";
import { useWallet } from "@/hooks/useWallet";
import { useWalletTransactions } from "@/hooks/useWalletTransactions";

interface AccountProps {
  defaultTab?: string;
}

const Account = ({ defaultTab }: AccountProps) => {
  const { user, signOut } = useAuth();
  const queryClient = useQueryClient();
  const [params, setParams] = useSearchParams();
  const nav = useNavigate();
  const tab = params.get("tab") || defaultTab || "orders";

  const [profile, setProfile] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // Wallet queries
  const { data: wallet, isLoading: isWalletLoading, refetch: refetchWallet } = useWallet();
  const { data: transactions, isLoading: isTransactionsLoading, refetch: refetchTransactions } = useWalletTransactions();

  const [rechargeAmount, setRechargeAmount] = useState(params.get("recharge") || "500");
  const [recharging, setRecharging] = useState(false);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }: any) => setProfile(data));
  }, [user]);

  const save = async () => {
    if (!user || !profile) return;
    setSaving(true);
    const { error } = await (supabase as any).from("profiles").update({
      full_name: (profile as any).full_name, phone: (profile as any).phone,
    }).eq("id", user.id);
    setSaving(false);
    if (error) toast.error(error.message); else toast.success("Profile saved");
  };

  const handleSimulatedRecharge = async () => {
    if (!user || !wallet?.id) {
      toast.error("Wallet not provisioned yet.");
      return;
    }
    const amt = parseFloat(rechargeAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid recharge amount.");
      return;
    }
    
    setRecharging(true);
    try {
      const { error } = await (supabase as any)
        .from("wallet_transactions")
        .insert({
          wallet_id: wallet.id,
          amount: amt,
          transaction_type: "recharge",
          reference_id: "SIM_" + Math.random().toString(36).substring(2, 10).toUpperCase(),
        });
        
      if (error) {
        toast.error(error.message);
      } else {
        toast.success(`Successfully recharged ₹${amt.toFixed(2)} (Simulated)`);
        queryClient.invalidateQueries({ queryKey: ['user-wallet-balance'] });
        queryClient.invalidateQueries({ queryKey: ['user-wallet-transactions'] });
        await refetchWallet();
        await refetchTransactions();
        
        const redirect = params.get("redirect");
        if (redirect) {
          toast.info("Redirecting back to complete your order...");
          setTimeout(() => nav(redirect), 1000);
        }
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setRecharging(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo title="My account — Eggscellent" description="Manage your profile, addresses and order preferences." />
      <Header />
      <main className="container max-w-2xl py-10">
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-2">My account</h1>
        <p className="text-muted-foreground mb-8">{profile?.email || profile?.phone || ""}</p>

        {/* Prepaid Wallet Balance Card */}
        <div className="bg-card border border-border/80 rounded-3xl shadow-card p-6 mb-8 relative overflow-hidden grain">
          <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full gradient-yolk opacity-10 blur-xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="eyebrow flex items-center gap-1.5 text-accent">
                <span>👛</span> Prepaid Wallet Balance
              </span>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display font-extrabold text-4xl text-brown tracking-tight">
                  ₹{isWalletLoading ? "..." : wallet?.balance?.toFixed(2)}
                </span>
                {!isWalletLoading && (wallet?.balance ?? 0.0) < 100 && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
                    Low Balance
                  </span>
                )}
              </div>
              {wallet && wallet.reserved_balance !== undefined && wallet.reserved_balance > 0 && (
                <p className="text-xs text-muted-foreground font-medium flex items-center gap-1 mt-1">
                  🔒 ₹{wallet.reserved_balance.toFixed(2)} reserved for scheduled deliveries
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Automatic deductions will occur upon successful deliveries.
              </p>
            </div>
            
            <Button 
              variant="secondary" 
              className="sm:w-auto w-full font-semibold rounded-full border border-border bg-background hover:bg-secondary/40 transition-smooth shrink-0"
              onClick={() => nav("/account/wallet")}
            >
              Recharge Wallet
            </Button>
          </div>
        </div>

        <Tabs value={tab} onValueChange={(v) => {
          if (v === "wallet") {
            nav("/account/wallet");
          } else {
            setParams({ tab: v });
          }
        }}>
          <TabsList className="grid grid-cols-5 w-full mb-6">
            <TabsTrigger value="orders">Orders</TabsTrigger>
            <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
            <TabsTrigger value="wallet">Wallet</TabsTrigger>
            <TabsTrigger value="addresses">Addresses</TabsTrigger>
            <TabsTrigger value="profile">Profile</TabsTrigger>
          </TabsList>

          <TabsContent value="orders"><OrdersList /></TabsContent>

          <TabsContent value="subscriptions" className="space-y-6">
            <AccountSubscriptions />
            <SubscriptionCalendar />
          </TabsContent>

          <TabsContent value="wallet">
            <div className="space-y-6">
              {/* Main Wallet Balance Card inside Tab */}
              <div className="bg-card rounded-3xl shadow-soft p-6 border border-border/80 relative overflow-hidden grain">
                <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full gradient-yolk opacity-10 blur-xl pointer-events-none" />
                <h3 className="text-sm eyebrow text-accent mb-2">Available Balance</h3>
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="font-display font-extrabold text-5xl text-brown tracking-tight">
                    ₹{isWalletLoading ? "..." : wallet?.balance?.toFixed(2)}
                  </span>
                  {!isWalletLoading && (wallet?.balance ?? 0.0) < 100 && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200">
                      Low Balance
                    </span>
                  )}
                </div>
                {wallet && wallet.reserved_balance !== undefined && wallet.reserved_balance > 0 && (
                  <p className="text-sm text-muted-foreground font-medium flex items-center gap-1.5 mb-2">
                    🔒 ₹{wallet.reserved_balance.toFixed(2)} reserved for scheduled deliveries
                  </p>
                )}
                <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                  Your prepaid wallet balance is the primary source of payment for delivery deductions. Minimum recommended balance is ₹100.
                </p>
                
                {/* Simulated Recharge Action Box */}
                <div className="bg-muted/40 rounded-2xl p-4 border border-border/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brown mb-2.5">Simulate Recharge (UPI/Netbanking)</h4>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground font-semibold">₹</span>
                      <Input
                        type="number"
                        className="pl-7 bg-background rounded-xl border-border"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(e.target.value)}
                        placeholder="Enter amount"
                      />
                    </div>
                    <Button
                      variant="hero"
                      onClick={handleSimulatedRecharge}
                      disabled={recharging || isWalletLoading}
                      className="rounded-xl font-semibold shadow-soft shrink-0 px-4"
                    >
                      {recharging ? "Processing..." : "Recharge"}
                    </Button>
                  </div>
                  <div className="flex gap-2.5 mt-3">
                    {["200", "500", "1000"].map((preset) => (
                      <button
                        key={preset}
                        onClick={() => setRechargeAmount(preset)}
                        className={`text-xs font-semibold px-3 py-1 rounded-full border transition-smooth ${
                          rechargeAmount === preset
                            ? "bg-brown text-white border-brown"
                            : "bg-background text-brown/80 border-border hover:bg-secondary/40"
                        }`}
                      >
                        +₹{preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Transactions Ledger Card */}
              <div className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 border border-border/60">
                <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
                  <h3 className="font-display font-semibold text-lg text-brown">Transaction Ledger</h3>
                  <span className="text-[11px] font-bold uppercase text-muted-foreground tracking-wider font-mono">
                    {transactions?.length || 0} Logs
                  </span>
                </div>
                
                {isTransactionsLoading ? (
                  <div className="text-center py-8 text-sm text-muted-foreground">Loading transaction ledger...</div>
                ) : !transactions || transactions.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <span className="text-3xl block mb-2">📋</span>
                    <p className="text-sm font-medium">No transactions recorded yet.</p>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">Your recharge and delivery deduction history will appear here.</p>
                  </div>
                ) : (
                  <div className="space-y-3.5 max-h-[320px] overflow-y-auto pr-1 no-scrollbar">
                    {transactions.map((tx) => {
                      const isPositive = ["recharge", "refund", "compensation"].includes(tx.transaction_type);
                      const displayAmount = Math.abs(tx.amount);
                      const formattedDate = new Date(tx.created_at).toLocaleDateString("en-IN", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      });
                      
                      const typeLabels: Record<string, string> = {
                        recharge: "Wallet Recharge",
                        delivery_deduction: "Delivery Deduction",
                        refund: "Refund",
                        admin_adjustment: "Admin Adjustment",
                        compensation: "Compensation Benefit"
                      };

                      return (
                        <div key={tx.id} className="flex items-center justify-between gap-3 text-xs bg-muted/20 p-3 rounded-xl border border-border/30 hover:bg-muted/40 transition-smooth">
                          <div>
                            <div className="font-bold text-brown text-sm">
                              {typeLabels[tx.transaction_type] || tx.transaction_type}
                            </div>
                            <div className="text-muted-foreground text-[10px] mt-0.5 flex items-center gap-1.5 font-mono">
                              <span>{formattedDate}</span>
                              {tx.reference_id && (
                                <>
                                  <span className="text-muted-foreground/30">•</span>
                                  <span className="uppercase text-[9px] bg-muted/80 px-1 rounded">{tx.reference_id}</span>
                                </>
                              )}
                            </div>
                          </div>
                          <div className={`font-mono font-bold text-sm shrink-0 ${isPositive ? "text-emerald-600" : "text-brown"}`}>
                            {isPositive ? "+" : "-"}₹{displayAmount.toFixed(2)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="addresses">
            <div className="bg-card rounded-3xl shadow-soft p-5 sm:p-6">
              <AddressPicker manageMode />
            </div>
          </TabsContent>

          <TabsContent value="profile">
            {profile && (
              <div className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 space-y-4">
                <div className="space-y-1.5"><Label>Full name</Label>
                  <Input value={profile.full_name || ""} onChange={e => setProfile({ ...profile, full_name: e.target.value })} />
                </div>
                <div className="space-y-1.5"><Label>Phone</Label>
                  <Input value={profile.phone || ""} onChange={e => setProfile({ ...profile, phone: e.target.value })} />
                </div>
                <div className="flex justify-between pt-2">
                  <Button variant="ghost" onClick={signOut}><LogOut className="w-4 h-4" /> Sign out</Button>
                  <Button variant="hero" onClick={save} disabled={saving}>Save</Button>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Account;
