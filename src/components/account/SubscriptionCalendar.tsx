import React, { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { handleSubscriptionPause, handleSubscriptionResume } from '@/lib/subscriptionUtils';

const HorizontalCalendarLedger = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [cachedLedger, setCachedLedger] = useState<any[]>([]);
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [horizonDates, setHorizonDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [userSubscription, setUserSubscription] = useState<any>(null);

  // Instantly compute the view target inside the UI thread (Zero Loading Spinners)
  const targetDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const dailyDeliveries = cachedLedger.filter(item => item.delivery_date === targetDateStr);

  useEffect(() => {
    const dates = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));
    setHorizonDates(dates);

    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  useEffect(() => {
    const fetchCatalog = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) {
        setGlobalProducts(data);
      }
    };
    fetchCatalog();
  }, []);

  const fetchBulkLedger = async (uid = userId) => {
    if (!uid) return;
    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);
      
      const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      // 1. Fetch Subscription Master Profiles (just to check existence if needed, but we rely on deliveries)
      const { data: subData } = await (supabase as any)
        .from('subscriptions')
        .select('*')
        .eq('user_id', uid);
      setUserSubscription(subData && subData.length > 0 ? subData[0] : null);

      // 2. Fetch Subscription Deliveries (Base)
      const { data: baseDeliveries } = await (supabase as any)
        .from('subscription_deliveries')
        .select('id, delivery_date, status, subscription_delivery_items(id, product_slug, quantity, effective_price)')
        .eq('user_id', uid)
        .gte('delivery_date', startStr)
        .lte('delivery_date', endStr);

      // 3. Fetch Ledger Overrides
      const { data: overrides } = await (supabase as any)
        .from('subscription_calendar_ledger')
        .select('*')
        .eq('user_id', uid)
        .gte('delivery_date', startStr)
        .lte('delivery_date', endStr);

      // Build unified cache array
      let itemsList: any[] = [];
      
      (baseDeliveries || []).forEach((del: any) => {
        (del.subscription_delivery_items || []).forEach((i: any) => {
          itemsList.push({
            id: i.id,
            delivery_id: del.id,
            delivery_date: del.delivery_date,
            status: del.status, // We map parent status for UI display
            product_slug: i.product_slug,
            quantity: i.quantity,
            effective_price: i.effective_price
          });
        });
      });

      // Apply overrides natively in memory to strip out skipped items
      const finalItems = itemsList.filter(item => {
        const matchingOverride = (overrides || []).find((o: any) => o.delivery_date === item.delivery_date && o.product_slug === item.product_slug);
        if (matchingOverride && matchingOverride.action_type === 'skip' && matchingOverride.override_quantity === 0) {
           return false; // Stripped by ledger dustbin
        }
        return true;
      });

      setCachedLedger(finalItems);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetchBulkLedger(userId).finally(() => setLoading(false));
    }
  }, [userId]);

  const handleResumeSubscription = async () => {
    if (!userSubscription) return;
    setActionLoading(true);
    try {
      await handleSubscriptionResume(supabase, userSubscription.id);
      await fetchBulkLedger(userId);
      toast.success("Subscription resumed!");
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Dustbin exclusion delete/skip handler
  const handleDeleteCalendarItem = async (item: any) => {
    const previousState = [...cachedLedger];
    setCachedLedger(prev => prev.filter(i => !(i.product_slug === item.product_slug && i.delivery_date === targetDateStr)));
    
    try {
      const { error } = await (supabase as any)
        .from('subscription_calendar_ledger')
        .insert({
          user_id: userId,
          subscription_id: userSubscription?.id || null,
          delivery_date: targetDateStr,
          product_slug: item.product_slug,
          action_type: 'skip',
          override_quantity: 0
        });
      if (error) throw error;
      toast.success("Item removed from this delivery date.");
    } catch (err) {
      toast.error("Failed to skip item.");
      setCachedLedger(previousState);
    }
  };

  const handleAddOneTimeItem = async (slug: string) => {
    // Left as stub per instruction scope which is centered around subscription integration.
    // If one-time additions from calendar are needed, they would hit one_time_orders.
    toast.error("One-Time add-ons must be managed from the main store.");
  };

  const availableAddons = globalProducts.filter(
    (product) => !dailyDeliveries.some((d) => d.product_slug === product.slug)
  );

  return (
    <div className="w-full max-w-md mx-auto bg-stone-50 min-h-screen flex flex-col font-sans">
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-50 rounded-b-3xl pb-2">
        <div className="p-5 pb-3 flex justify-between items-center">
          <h2 className="text-lg font-bold text-stone-800 tracking-tight">Delivery Schedule</h2>
          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full shadow-sm">
            {format(selectedDate, 'MMMM yyyy')}
          </span>
        </div>

        <div className="flex overflow-x-auto px-5 pb-4 space-x-3 scrollbar-none snap-x">
          {horizonDates.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
            const hasDelivery = cachedLedger.some(i => i.delivery_date === format(date, 'yyyy-MM-dd'));

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center min-w-[64px] h-[86px] rounded-2xl transition-all duration-300 ease-out snap-center border ${isSelected
                  ? 'bg-gradient-to-b from-amber-500 to-orange-500 border-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                  : 'bg-white border-stone-200/80 text-stone-700 hover:border-amber-300 hover:shadow-md'
                  }`}
              >
                <span className={`text-[11px] font-bold uppercase tracking-widest ${isSelected ? 'text-amber-100' : 'text-stone-400'}`}>
                  {format(date, 'EEE')}
                </span>
                <span className="text-2xl font-extrabold mt-1">
                  {format(date, 'd')}
                </span>
                <div className={`w-1.5 h-1.5 rounded-full mt-2 transition-colors ${isSelected ? 'bg-white' : hasDelivery ? 'bg-amber-500' : 'bg-transparent'}`} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex-1 p-5 space-y-8 overflow-y-auto pb-24">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-stone-800 tracking-tight">
                Deliveries for {format(selectedDate, 'EEEE, dd MMM')}
              </h3>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-pulse flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
                  <span className="text-sm text-stone-400 font-bold">Syncing Ledger...</span>
                </div>
              </div>
            ) : dailyDeliveries.length === 0 ? (
              <div className="bg-white p-8 rounded-3xl border border-stone-200/60 flex flex-col items-center justify-center text-center space-y-3 shadow-sm">
                <div className="w-16 h-16 bg-stone-50 rounded-full flex items-center justify-center text-2xl mb-2">
                  📦
                </div>
                <h4 className="text-base font-bold text-stone-800">No Scheduled Drops</h4>
                <p className="text-sm text-stone-500 font-medium max-w-[200px]">You have no active items arriving on this day.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {dailyDeliveries.map((item) => {
                  const liveProduct = globalProducts.find(p => p.slug === item.product_slug);
                  const productData = liveProduct || item.products;

                  const isOOS = productData?.out_of_stock_subscriptions === true || 
                                (productData?.stock_subscriptions !== undefined && productData.stock_subscriptions <= 0) || 
                                item.status === 'out_of_stock';
                  const isItemInStock = !isOOS;
                  
                  const displayPrice = item.effective_price && Number(item.effective_price) !== 0
                    ? Number(item.effective_price)
                    : Number(productData?.discounted_price || productData?.original_price || 0);

                  let statusBadge = null;
                  if (!isItemInStock) {
                    statusBadge = null;
                  } else if (item.status === 'delivered') {
                    statusBadge = <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">✅ Delivered</span>;
                  } else if (item.status === 'out_for_delivery') {
                    statusBadge = <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full animate-pulse">🚴 Out for Delivery</span>;
                  } else {
                    statusBadge = <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">⏳ Scheduled</span>;
                  }

                  return (
                    <div key={item.id} className={`bg-white p-4 rounded-3xl border flex items-center justify-between shadow-sm transition-all ${!isItemInStock ? 'opacity-60 bg-stone-50 border-stone-200' : 'border-stone-200 hover:shadow-md'}`}>
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-stone-100 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-stone-400 text-2xl shadow-inner border border-stone-200/50 min-w-[56px]">
                          <img 
                            src={productData?.image_url || 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=120&q=80'} 
                            alt="Product" 
                            className="w-12 h-12 rounded-xl object-cover bg-stone-100"
                            onError={(e) => {
                              e.currentTarget.onerror = null; 
                              e.currentTarget.src = 'https://images.unsplash.com/photo-1516448620398-c5f44bf9f441?w=120&q=80';
                            }}
                          />
                        </div>
                        <div className="flex flex-col space-y-1">
                          <h4 className="text-sm font-extrabold text-stone-800 tracking-tight">{productData?.name || item.product_slug}</h4>
                          <div className="flex items-center space-x-2">
                            <span className="text-xs font-bold text-stone-500">₹{displayPrice}</span>
                            {isItemInStock && (
                              <>
                                <span className="text-[10px] text-stone-300">•</span>
                                {statusBadge}
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-3">
                        <div className="flex flex-col items-end space-y-2">
                          {!isItemInStock ? (
                            <span className="text-[10px] font-extrabold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200 text-right max-w-[180px] leading-tight">
                              ⚠️ Out of Stock - We are sorry, couldn't deliver right now. Will be fulfilled automatically if restocked before delivery.
                            </span>
                          ) : (
                            <span className="px-1 min-w-[24px] text-center text-sm font-extrabold text-stone-800">{item.quantity}x</span>
                          )}
                        </div>
                        
                        <button
                          disabled={actionLoading}
                          onClick={() => handleDeleteCalendarItem(item)}
                          className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                          title="Remove from schedule"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
      </div>
    </div>
  );
};

export default HorizontalCalendarLedger;
