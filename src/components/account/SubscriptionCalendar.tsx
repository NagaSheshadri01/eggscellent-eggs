import { useState, useMemo } from "react";
import { useDeliveryCalendar } from "@/hooks/useDeliveryCalendar";
import { Button } from "@/components/ui/button";
import { Calendar, ChevronLeft, ChevronRight, Check, X, ShieldAlert, Lock, Moon, Plus, Minus } from "lucide-react";
import { toast } from "sonner";
import { useProducts } from "@/hooks/useProducts";
import { useAuth } from "@/context/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const toDateString = (year: number, month: number, day: number) => {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
};

const SubscriptionCalendar = () => {
  const { user } = useAuth();
  const { data: ledger = [], isLoading, toggleSkip, updateVolume, addStandaloneItem } = useDeliveryCalendar();
  const { data: products = [] } = useProducts({ onlyActive: true });
  const [currentDate, setCurrentDate] = useState(new Date());

  const { data: activeSubscriptions = [] } = useQuery({
    queryKey: ["active-subscriptions-calendar"],
    queryFn: async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("id, product_slug, selected_days, quantity, products(name, discounted_price)")
        .eq("user_id", user?.id)
        .eq("status", "active");
      return data || [];
    },
    enabled: !!user?.id,
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // First weekday index (0 = Sun, 1 = Mon...)
  const firstDayIndex = new Date(year, month, 1).getDay();
  // Total days in the month
  const totalDays = new Date(year, month + 1, 0).getDate();

  // Navigation handlers
  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  // Selected date management for slide-over toggle panel
  const [selectedDayInfo, setSelectedDayInfo] = useState<{
    dateStr: string;
    dayNum: number;
    ledgerRows: any[];
  } | null>(null);

  // Group ledger entries by date for fast O(1) lookups
  const ledgerMap = useMemo(() => {
    const map = new Map<string, any[]>();
    ledger.forEach((item: any) => {
      if (!map.has(item.delivery_date)) map.set(item.delivery_date, []);
      map.get(item.delivery_date)!.push(item);
    });
    return map;
  }, [ledger]);

  // Today reference for past/future validation
  const todayStr = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }, []);

  const handleDayClick = (day: number) => {
    const dateStr = toDateString(year, month, day);
    const dateObj = new Date(year, month, day);
    const currentDayIndex = dateObj.getDay();
    let ledgerRows = [...(ledgerMap.get(dateStr) || [])];

    // Hydrate JIT base subscriptions
    activeSubscriptions.forEach((sub: any) => {
      const days = (sub.selected_days || []).map((d: any) => Number(d));
      const isScheduledDay = days.includes(currentDayIndex);
      const baseProductExistsInLedger = ledgerRows.some(row => row.product_slug === sub.product_slug);
      
      if (isScheduledDay && !baseProductExistsInLedger) {
        ledgerRows.unshift({
          isVirtual: true,
          subscription_id: sub.id,
          delivery_date: dateStr,
          product_slug: sub.product_slug,
          quantity: sub.quantity || 1,
          effective_price: sub.products?.discounted_price || 0,
          status: 'scheduled',
          virtual_product_name: sub.products?.name || sub.product_slug
        });
      }
    });

    // Past / Present evaluation lock
    if (dateStr <= todayStr) {
      toast.error("This delivery date has already passed or is active today. Past records are immutable.", {
        id: "past-lock",
        icon: "🔒",
      });
      return;
    }

    setSelectedDayInfo({
      dateStr,
      dayNum: day,
      ledgerRows,
    });
  };

  const handleToggleStatus = async () => {
    if (!selectedDayInfo?.ledgerRow) return;
    const { ledgerRow } = selectedDayInfo;
    const newStatus = ledgerRow.status === "skipped" ? "scheduled" : "skipped";

    try {
      await toggleSkip.mutateAsync({
        id: ledgerRow.id,
        status: newStatus,
      });
      setSelectedDayInfo({
        ...selectedDayInfo,
        ledgerRow: { ...ledgerRow, status: newStatus }
      });
    } catch (e) {
      // toast handled in hook mutation callbacks
    }
  };

  const handleUpdateVolume = async (ledgerRow: any, delta: number) => {
    const newQty = Math.max(0, ledgerRow.quantity + delta);
    
    try {
      await updateVolume.mutateAsync({ 
        id: ledgerRow.isVirtual ? null : ledgerRow.id,
        quantity: newQty,
        subscription_id: ledgerRow.subscription_id,
        delivery_date: ledgerRow.delivery_date,
        product_slug: ledgerRow.product_slug,
        effective_price: ledgerRow.effective_price
      });
      
      // Remove virtual flag on local update so it behaves like a real row
      const updatedRow = { ...ledgerRow, quantity: newQty, status: newQty <= 0 ? "skipped" : "scheduled", isVirtual: false };
      setSelectedDayInfo((prev: any) => {
        if (!prev) return prev;
        const newRows = prev.ledgerRows.map((r: any) => r.product_slug === ledgerRow.product_slug ? updatedRow : r);
        return { ...prev, ledgerRows: newRows };
      });
    } catch (e) {}
  };

  const handleAddStandalone = async (product_slug: string, price: number) => {
    if (!selectedDayInfo) return;
    try {
      await addStandaloneItem.mutateAsync({
        date: selectedDayInfo.dateStr,
        product_slug,
        price
      });
      // Drawer will be closed or data refetched in background. Let's just close it.
      setSelectedDayInfo(null);
    } catch (e) {}
  };

  // Generate blank grids for offset alignment
  const blanks = Array.from({ length: firstDayIndex }, (_, i) => i);
  const days = Array.from({ length: totalDays }, (_, i) => i + 1);

  return (
    <div className="space-y-6">
      {/* Calendar Dashboard Card */}
      <div className="bg-card rounded-3xl border border-border/60 shadow-soft p-5 sm:p-6 relative overflow-hidden grain">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full gradient-yolk opacity-10 blur-xl pointer-events-none" />
        
        {/* Top Month Header Navigation */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/20 text-accent grid place-items-center">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-brown text-lg tracking-tight">
                {MONTHS[month]} {year}
              </h3>
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider font-bold">
                Delivery Calendar
              </p>
            </div>
          </div>

          <div className="flex gap-1.5 bg-secondary/40 p-1 rounded-full border border-border/40">
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 rounded-full text-brown/80 hover:text-brown"
              onClick={handlePrevMonth}
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="w-8 h-8 rounded-full text-brown/80 hover:text-brown"
              onClick={handleNextMonth}
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-sm text-muted-foreground font-semibold">
            Synchronizing delivery ledger database...
          </div>
        ) : (
          <div className="space-y-4">
            {/* Weekdays label list */}
            <div className="grid grid-cols-7 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 font-mono">
              {WEEKDAYS.map((day) => (
                <div key={day} className="py-1">
                  {day}
                </div>
              ))}
            </div>

            {/* Granular Days Grid */}
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {/* Render offsetting blank day grids */}
              {blanks.map((b) => (
                <div key={`blank-${b}`} className="aspect-square bg-muted/10 rounded-2xl opacity-30 border border-transparent" />
              ))}

              {/* Render actual days */}
              {days.map((day) => {
                const dateStr = toDateString(year, month, day);
                const ledgerRows = ledgerMap.get(dateStr) || [];
                const isPast = dateStr <= todayStr;
                
                // Add the JIT evaluation
                const dateObj = new Date(year, month, day);
                const currentDayIndex = dateObj.getDay();
                let hasJitScheduled = false;
                
                activeSubscriptions.forEach((sub: any) => {
                  const days = (sub.selected_days || []).map((d: any) => Number(d));
                  if (days.includes(currentDayIndex)) hasJitScheduled = true;
                });

                const activeLedgerRows = ledgerRows.filter((r: any) => r.status !== "cancelled");
                const hasLedger = activeLedgerRows.length > 0;
                let overallStatus = null;

                // 1. Evaluate physical ledger rows
                if (hasLedger) {
                  overallStatus = "skipped";
                  if (activeLedgerRows.some((r: any) => r.status === "scheduled")) overallStatus = "scheduled";
                  else if (activeLedgerRows.some((r: any) => r.status === "delivered")) overallStatus = "delivered";
                  else if (activeLedgerRows.some((r: any) => r.status === "pending_payment")) overallStatus = "pending_payment";
                  else if (activeLedgerRows.some((r: any) => r.status === "paused")) overallStatus = "paused";
                  else if (activeLedgerRows.some((r: any) => r.status === "failed")) overallStatus = "failed";
                } 
                // 2. Evaluate JIT (virtual) base subscriptions
                else if (hasJitScheduled && !isPast) {
                  overallStatus = "scheduled";
                }

                // Color coding logic based on Ledger status
                let borderStyle = "border-border/30 hover:border-accent/40 bg-card";
                let statusColor = "bg-slate-300";
                let textStyle = "text-brown";

                if (overallStatus) {
                  switch (overallStatus) {
                    case "scheduled":
                      borderStyle = "border-sky-200 bg-sky-50/20 hover:border-sky-400/80 shadow-sm";
                      statusColor = "bg-sky-500 shadow-[0_0_8px_rgba(14,165,233,0.6)] animate-pulse";
                      break;
                    case "delivered":
                      borderStyle = "border-emerald-200 bg-emerald-50/20";
                      statusColor = "bg-emerald-500";
                      textStyle = "text-emerald-950 font-bold";
                      break;
                    case "skipped":
                      borderStyle = "border-slate-200/60 bg-slate-50/25";
                      statusColor = "bg-slate-400";
                      textStyle = "text-slate-400/80 line-through font-normal";
                      break;
                    case "paused":
                      borderStyle = "border-amber-200 bg-amber-50/20";
                      statusColor = "bg-amber-500";
                      break;
                    case "failed":
                      borderStyle = "border-rose-200 bg-rose-50/20";
                      statusColor = "bg-rose-500";
                      textStyle = "text-rose-950";
                      break;
                  }
                }

                return (
                  <button
                    key={`day-${day}`}
                    onClick={() => handleDayClick(day)}
                    className={`relative aspect-square flex flex-col items-center justify-between p-2 rounded-2xl border transition-smooth ${borderStyle} ${
                      isPast && hasLedger ? "opacity-60 cursor-not-allowed bg-muted/20" : ""
                    } ${isPast && !hasLedger ? "cursor-not-allowed opacity-30" : "hover:-translate-y-0.5 active:scale-95 hover:border-accent/40"}`}
                    disabled={isPast}
                  >
                    {/* Top row: Date Number + Past Lock Icon */}
                    <div className="w-full flex items-center justify-between">
                      <span className={`text-xs font-semibold font-mono ${textStyle}`}>{day}</span>
                      {isPast && hasLedger && (
                        <Lock className="w-2.5 h-2.5 text-muted-foreground opacity-60" title="Past Record Immutable" />
                      )}
                    </div>

                    {/* Bottom row: Glow indicator dot */}
                    {overallStatus && (
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${statusColor}`} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Quick Status Color Legend Key */}
            <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest pt-4 border-t border-border/30 mt-4">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.5)]" /> Scheduled
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Delivered
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-400" /> Skipped
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Paused
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> Failed
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Slide-over Overlay Drawer / Dialog Wrapper for Day Skip Trigger */}
      {selectedDayInfo && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-card border border-border rounded-t-3xl sm:rounded-3xl p-5 sm:p-6 max-w-sm w-full shadow-card animate-scale-in text-center space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/40">
              <h4 className="font-display font-extrabold text-brown text-base">
                Fulfillment Adjustments for {new Date(selectedDayInfo.dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
              </h4>
              <button
                onClick={() => setSelectedDayInfo(null)}
                className="w-7 h-7 rounded-full bg-secondary/50 hover:bg-secondary grid place-items-center text-brown/70 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 py-2 text-left">
              
              {/* Action 1: Adjust Scheduled Items */}
              {selectedDayInfo.ledgerRows && selectedDayInfo.ledgerRows.filter((r: any) => r.status !== 'skipped').length > 0 ? (
                <div className="bg-muted/30 rounded-2xl p-4 border border-border/40">
                  <h5 className="text-xs font-bold text-brown mb-3 uppercase tracking-wider">Scheduled For Today</h5>
                  <div className="space-y-3">
                    {selectedDayInfo.ledgerRows.filter((r: any) => r.status !== 'skipped').map((row: any) => (
                      <div key={row.id || row.product_slug} className="flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-brown capitalize flex items-center gap-2">
                            {row.virtual_product_name || row.product_slug.replace(/-/g, " ")}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">Rate: ₹{row.effective_price.toFixed(2)}</div>
                        </div>
                        <div className="flex items-center gap-2 bg-background border border-border/50 rounded-xl p-1 shadow-sm">
                          <button onClick={() => handleUpdateVolume(row, -1)} disabled={updateVolume.isPending || row.quantity <= 0} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-secondary text-brown disabled:opacity-50 transition-colors">
                            <Minus className="w-4 h-4" />
                          </button>
                          <span className="text-sm font-bold w-6 text-center">{row.quantity}</span>
                          <button onClick={() => handleUpdateVolume(row, 1)} disabled={updateVolume.isPending} className="w-8 h-8 grid place-items-center rounded-lg hover:bg-secondary text-brown transition-colors">
                            <Plus className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground italic text-center py-4 bg-muted/20 rounded-2xl border border-border/30">
                  No active deliveries scheduled for this date.
                </div>
              )}

              {/* Action 2: Add-on Marketplace Pipeline */}
              <div>
                <h5 className="text-xs font-bold text-brown mb-3 uppercase tracking-wider pl-1">The Add-on Marketplace</h5>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto no-scrollbar pb-2">
                  {products
                    .filter((p: any) => {
                      const activeItems = selectedDayInfo.ledgerRows ? selectedDayInfo.ledgerRows.filter((r: any) => r.status !== 'skipped') : [];
                      return !activeItems.some((item: any) => item.product_slug === p.slug);
                    })
                    .map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-card rounded-xl p-2.5 border border-border/50 shadow-soft hover:shadow-card transition-smooth">
                      <div className="flex items-center gap-3">
                        {p.image_url && <img src={p.image_url} alt={p.name} className="w-10 h-10 rounded-lg object-cover" />}
                        <div>
                          <div className="text-xs font-semibold text-brown">{p.name}</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">₹{p.discounted_price}</div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="hero"
                        disabled={addStandaloneItem.isPending}
                        onClick={() => handleAddStandalone(p.slug, p.discounted_price)}
                        className="h-8 rounded-lg px-3 text-[10px] gap-1 shadow-sm"
                      >
                        <Plus className="w-3 h-3" /> Add
                      </Button>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            <p className="text-[9px] text-muted-foreground leading-relaxed pt-2 border-t border-border/40">
              * Base volume adjustments or single-day add-ons affect this specific delivery date only.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionCalendar;
