import React, { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Trash2, Lock, Plus, Minus } from 'lucide-react';
import { handleSubscriptionPause } from '@/lib/subscriptionUtils';

const isDateLocked = (targetDate: Date) => {
  const now = new Date();
  const currentUTC = now.getUTCHours() + now.getUTCMinutes() / 60;
  const passed9PM = currentUTC >= 15.5;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const target = new Date(targetDate);
  target.setHours(0, 0, 0, 0);

  const diffDays = Math.round((target.getTime() - today.getTime()) / 86400000);

  if (diffDays <= 0) return true;
  if (diffDays === 1) return passed9PM;
  return false;
};

const HorizontalCalendarLedger = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [projectedLedger, setProjectedLedger] = useState<any[]>([]);
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [horizonDates, setHorizonDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  const targetDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  
  const dailyDeliveries = projectedLedger.filter(item => item.delivery_date === targetDateStr);
  const isSelectedDateLocked = isDateLocked(selectedDate);

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

  const fetchDynamicLedger = async (uid = userId) => {
    if (!uid) return;
    try {
      const today = new Date();
      const endDate = new Date();
      endDate.setDate(today.getDate() + 30);
      
      const startStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const endStr = `${endDate.getFullYear()}-${String(endDate.getMonth() + 1).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

      const { data: subData } = await (supabase as any)
        .from('subscriptions')
        .select('*')
        .eq('user_id', uid)
        .eq('status', 'active');

      const { data: manifestDrops } = await (supabase as any)
        .from('subscription_deliveries')
        .select('id, delivery_date, status, subscription_delivery_items(id, product_slug, quantity, effective_price)')
        .eq('user_id', uid)
        .gte('delivery_date', startStr)
        .lte('delivery_date', endStr);

      let itemsList: any[] = [];
      const generatedDropsMap = new Map();
      
      (manifestDrops || []).forEach((del: any) => {
        generatedDropsMap.set(del.delivery_date, true);
        (del.subscription_delivery_items || []).forEach((i: any) => {
          itemsList.push({
            id: i.id,
            delivery_id: del.id,
            delivery_date: del.delivery_date,
            status: del.status,
            product_slug: i.product_slug,
            quantity: i.quantity,
            effective_price: i.effective_price,
            is_manifest: true,
            subscription_id: null
          });
        });
      });

      if (subData && subData.length > 0) {
        subData.forEach((sub: any) => {
          let allowedDays = sub.selected_days || [];
          if (typeof allowedDays === 'string') {
            try { allowedDays = JSON.parse(allowedDays); } catch(e) {}
          }
          const allowedDaysArray = Array.isArray(allowedDays) ? allowedDays : [];

          for (let i = 0; i < 30; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
            
            const dayOfWeek = d.getDay();
            
            const isScheduledDay = sub.frequency === 'daily' || allowedDaysArray.includes(dayOfWeek) || allowedDaysArray.includes(String(dayOfWeek));

            if (!generatedDropsMap.has(dateStr) && isScheduledDay) {
              itemsList.push({
                id: `proj_${sub.id}_${dateStr}`,
                delivery_id: null,
                subscription_id: sub.id,
                delivery_date: dateStr,
                status: 'scheduled',
                product_slug: sub.product_slug,
                quantity: sub.quantity,
                effective_price: 0,
                is_manifest: false
              });
            }
          }
        });
      }

      setProjectedLedger(itemsList);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (userId) {
      setLoading(true);
      fetchDynamicLedger(userId).finally(() => setLoading(false));
    }
  }, [userId]);

  const handleDeleteCalendarItem = async (item: any) => {
    if (item.is_manifest) {
      toast.info("Cannot remove locked deliveries from this view.");
      return;
    }
    if (!item.subscription_id) return;
    
    setActionLoading(true);
    try {
      await handleSubscriptionPause(supabase as any, item.subscription_id);
      toast.success("Subscription paused successfully.");
      await fetchDynamicLedger(userId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdateQuantity = async (item: any, newQuantity: number) => {
    if (newQuantity < 1 || item.is_manifest || !item.subscription_id) return;
    setActionLoading(true);
    try {
      const { error } = await (supabase as any).from('subscriptions').update({ quantity: newQuantity }).eq('id', item.subscription_id);
      if (error) throw error;
      toast.success("Quantity updated successfully.");
      await fetchDynamicLedger(userId);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-stone-50 min-h-screen flex flex-col font-sans">
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-50 rounded-b-3xl pb-2">
        <div className="p-5 pb-3 flex justify-between items-center">
          <h2 className="text-lg font-bold text-stone-800 tracking-tight">Delivery Schedule</h2>
          <span className="text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1.5 rounded-full shadow-sm flex items-center gap-1">
            {isDateLocked(new Date()) ? <Lock className="w-3 h-3"/> : null}
            {format(selectedDate, 'MMMM yyyy')}
          </span>
        </div>

        <div className="flex overflow-x-auto px-5 pb-4 space-x-3 scrollbar-none snap-x">
          {horizonDates.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            const hasDelivery = projectedLedger.some(i => i.delivery_date === dateStr);
            const locked = isDateLocked(date);

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`relative flex flex-col items-center justify-center min-w-[64px] h-[86px] rounded-2xl transition-all duration-300 ease-out snap-center border ${isSelected
                  ? 'bg-gradient-to-b from-amber-500 to-orange-500 border-amber-500 text-white shadow-lg shadow-amber-500/30 scale-105'
                  : 'bg-white border-stone-200/80 text-stone-700 hover:border-amber-300 hover:shadow-md'
                  }`}
              >
                {locked && !isSelected && (
                  <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-stone-300" />
                )}
                {locked && isSelected && (
                  <Lock className="absolute top-1.5 right-1.5 w-3 h-3 text-amber-200" />
                )}
                
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
              <h3 className="text-sm font-bold text-stone-800 tracking-tight flex items-center gap-2">
                Deliveries for {format(selectedDate, 'EEEE, dd MMM')}
                {isSelectedDateLocked && <Lock className="w-4 h-4 text-stone-400" />}
              </h3>
            </div>

            {loading ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-pulse flex flex-col items-center space-y-3">
                  <div className="w-8 h-8 border-4 border-amber-200 border-t-amber-500 rounded-full animate-spin" />
                  <span className="text-sm text-stone-400 font-bold">Syncing Schedule...</span>
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
                {isSelectedDateLocked && (
                  <div className="bg-stone-100 text-stone-500 text-xs px-4 py-2 rounded-xl flex items-center gap-2">
                    <Lock className="w-4 h-4 shrink-0" />
                    Orders for this date are locked and cannot be edited.
                  </div>
                )}
                
                {dailyDeliveries.map((item) => {
                  const liveProduct = globalProducts.find(p => p.slug === item.product_slug);
                  const productData = liveProduct || item;

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
                              ⚠️ Out of Stock - Will be fulfilled automatically if restocked before delivery.
                            </span>
                          ) : (
                            <div className="flex items-center gap-2">
                              {!isSelectedDateLocked && !item.is_manifest && (
                                <button 
                                  onClick={() => handleUpdateQuantity(item, item.quantity - 1)}
                                  disabled={actionLoading || item.quantity <= 1}
                                  className="w-6 h-6 flex items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                              )}
                              <span className="min-w-[20px] text-center text-sm font-extrabold text-stone-800">{item.quantity}</span>
                              {!isSelectedDateLocked && !item.is_manifest && (
                                <button 
                                  onClick={() => handleUpdateQuantity(item, item.quantity + 1)}
                                  disabled={actionLoading}
                                  className="w-6 h-6 flex items-center justify-center rounded-full bg-stone-100 text-stone-600 hover:bg-stone-200 disabled:opacity-50"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        
                        {!isSelectedDateLocked && !item.is_manifest && (
                          <button
                            disabled={actionLoading}
                            onClick={() => handleDeleteCalendarItem(item)}
                            className="p-2 text-stone-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center"
                            title="Pause this subscription"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
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
