import React, { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const HorizontalCalendarLedger = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyDeliveries, setDailyDeliveries] = useState<any[]>([]);
  const [globalProducts, setGlobalProducts] = useState<any[]>([]);
  const [horizonDates, setHorizonDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [actionLoading, setActionLoading] = useState<boolean>(false);
  const [userId, setUserId] = useState<string | null>(null);

  // 1. Generate a continuous 30-day horizontal timeline strip
  useEffect(() => {
    const dates = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));
    setHorizonDates(dates);

    // Grab the current user session
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) setUserId(data.user.id);
    });
  }, []);

  // 2. Fetch inventory catalog to enable functional manual item additions & fallback joining
  useEffect(() => {
    const fetchCatalog = async () => {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) {
        setGlobalProducts(data);
      }
    };
    fetchCatalog();
  }, []);

  // 3. Fetch active ledger entries OR fallback to active subscriptions
  const fetchActiveLedgerForDate = async (
    dateObject: Date,
    currentUserId?: string | null,
    currentProducts?: any[]
  ) => {
    let activeUserId = currentUserId !== undefined ? currentUserId : userId;
    let activeProducts = currentProducts !== undefined ? currentProducts : globalProducts;

    if (!activeUserId) {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        activeUserId = data.user.id;
        setUserId(data.user.id);
      }
    }

    if (!activeProducts || activeProducts.length === 0) {
      const { data, error } = await supabase.from('products').select('*');
      if (!error && data) {
        activeProducts = data;
        setGlobalProducts(data);
      }
    }

    if (!activeUserId || !activeProducts || activeProducts.length === 0) return;

    setLoading(true);
    try {
      const year = dateObject.getFullYear();
      const month = String(dateObject.getMonth() + 1).padStart(2, '0');
      const day = String(dateObject.getDate()).padStart(2, '0');
      const formattedDateString = `${year}-${month}-${day}`;

      const { data, error } = await supabase
        .from('delivery_ledger')
        .select('id, quantity, delivery_date, subscription_id, product_slug, effective_price, status, products(*)')
        .eq('delivery_date', formattedDateString);

      if (error) throw error;

      if (data && data.length > 0) {
        // Filter out completely skipped/cancelled items from the active list if they exist in ledger
        const activeRows = (data as any[]).filter(r => r.status !== 'skipped' && r.status !== 'cancelled');
        setDailyDeliveries(activeRows);
      } else {
        // FALLBACK: Query the subscriptions table to fill the generational break
        const { data: subData, error: subError } = await supabase
          .from('subscriptions')
          .select('id, product_slug, quantity, selected_days, status')
          .eq('user_id', activeUserId)
          .eq('status', 'active');

        if (subError) throw subError;

        const targetDayOfWeek = dateObject.getDay(); // 0 = Sunday, 1 = Monday, etc.

        const activeToday = (subData || []).filter(sub =>
          sub.selected_days && sub.selected_days.includes(targetDayOfWeek)
        ).map(sub => {
          // Manual left join using our global catalog
          const product = activeProducts.find(p => p.slug === sub.product_slug);
          return {
            id: `sub-fallback-${sub.id}`,
            quantity: sub.quantity,
            delivery_date: formattedDateString,
            subscription_id: sub.id,
            product_slug: sub.product_slug,
            effective_price: product?.price || 0,
            status: 'scheduled',
            products: product
          };
        });

        setDailyDeliveries(activeToday);
      }
    } catch (err: any) {
      console.error("Calendar load failure:", err);
      toast.error(`Sync Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveLedgerForDate(selectedDate);
  }, [selectedDate]);

  // 4. Set up realtime listener for inventory changes
  useEffect(() => {
    const productsChannel = supabase
      .channel('products-changes')
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to ALL events (including when RLS hides the row, acting as a DELETE)
          schema: 'public',
          table: 'products',
        },
        (payload) => {
          // Whenever inventory changes structurally, re-pull the data to guarantee sync across RLS boundaries
          const fetchCatalog = async () => {
            const { data } = await supabase.from('products').select('*');
            if (data) {
              setGlobalProducts(data);
              fetchActiveLedgerForDate(selectedDate, userId, data);
            }
          };
          fetchCatalog();
        }
      )
      .subscribe();

    const ledgerChannel = supabase
      .channel('ledger-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'delivery_ledger',
          // Assuming user_id filter is not strictly needed client-side if we just re-fetch the local date state
        },
        (payload) => {
          fetchActiveLedgerForDate(selectedDate);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(ledgerChannel);
    };
  }, []);

  // Handle Increments & Decrements (and deletions)
  const handleQuantityChange = async (item: any, delta: number) => {
    if (!userId) return;
    setActionLoading(true);

    try {
      // Enforce this string generator block at the start of ALL calendar mutation methods:
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const targetedDateString = `${year}-${month}-${day}`;

      const newQuantity = item.quantity + delta;
      const isFallback = String(item.id).startsWith('sub-fallback-');

      if (isFallback) {
        // Need to materialize the virtual subscription row into the ledger
        // Need to materialize the virtual subscription row into the ledger
        if (newQuantity <= 0) {
          // Skip for the day
          await supabase.from('delivery_ledger').insert({
            user_id: userId,
            delivery_date: targetedDateString,
            product_slug: item.product_slug,
            subscription_id: item.subscription_id,
            quantity: 0,
            effective_price: item.effective_price,
            status: 'skipped'
          } as any);
        } else {
          // Execute a clean database .insert() expanding an existing schedule
          await supabase.from('delivery_ledger').insert({
            user_id: userId,
            delivery_date: targetedDateString,
            product_slug: item.product_slug,
            subscription_id: item.subscription_id,
            quantity: newQuantity,
            effective_price: item.effective_price,
            status: 'scheduled'
          } as any);
        }
      } else {
        // Item already exists in ledger
        if (newQuantity <= 0) {
          // Completely remove item from this date profile
          await supabase.from('delivery_ledger').delete().eq('id', item.id);
        } else {
          // Update quantity
          await (supabase.from('delivery_ledger') as any).update({ quantity: newQuantity }).eq('id', item.id);
        }
      }

      // Re-render
      await fetchActiveLedgerForDate(selectedDate);
    } catch (err: any) {
      toast.error(`Update failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // 4. OPERATIONAL ADDITION HANDLER: Inserts explicit user_id into ledger
  const handleAddOneTimeItem = async (slug: string) => {
    if (!userId) {
      toast.error("User session missing.");
      return;
    }
    setActionLoading(true);
    try {
      // Enforce this string generator block at the start of ALL calendar mutation methods:
      const year = selectedDate.getFullYear();
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const targetedDateString = `${year}-${month}-${day}`;

      const targetProduct = globalProducts.find(p => p.slug === slug);

      // Check if a ledger row already exists to prevent duplicate upserts
      const existingItem = dailyDeliveries.find(d => d.product_slug === slug && !String(d.id).startsWith('sub-fallback-'));
      
      if (existingItem) {
        await (supabase.from('delivery_ledger') as any)
          .update({ quantity: existingItem.quantity + 1 })
          .eq('id', existingItem.id);
      } else {
        const { error } = await supabase
          .from('delivery_ledger')
          .insert({
            delivery_date: targetedDateString,
            product_slug: slug,
            quantity: 1,
            effective_price: targetProduct?.discounted_price || targetProduct?.original_price || 0,
            status: 'scheduled',
            user_id: userId // CRITICAL: Explicit ownership for RLS bypass!
          } as any);

        if (error) throw error;
      }

      toast.success("Added to today's schedule!");
      fetchActiveLedgerForDate(selectedDate); // Re-render items instantly
    } catch (err: any) {
      toast.error(`Could not add item: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Determine available add-ons
  const availableAddons = globalProducts.filter(
    (product) => !dailyDeliveries.some((d) => d.product_slug === product.slug)
  );

  return (
    <div className="w-full max-w-md mx-auto bg-stone-50 min-h-screen flex flex-col font-sans">

      {/* TOP MODULE: PREMIUM HORIZONTAL TRACK STRIP */}
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
            // Simulate dot indicator logic (could be tied to actual fetched monthly calendar data in a full app)
            const hasDelivery = false;

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

        {/* MIDDLE MODULE: ACTIVE DELIVERIES */}
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
                // By strictly checking the live globalProducts list, we guarantee that if an admin 
                // deactivates a product (making it fail RLS and vanish), it instantly drops to "Out of Stock".
                const liveProduct = globalProducts.find(p => p.slug === item.product_slug);
                
                const isItemInStock = !(liveProduct?.out_of_stock_subscriptions === true || item.status === 'out_of_stock');
                
                // Fallback to initial payload only for static visual data like name/image if it vanishes from live catalog
                const productData = liveProduct || item.products;

                const displayPrice = item.effective_price && Number(item.effective_price) !== 0
                  ? Number(item.effective_price)
                  : Number(productData?.discounted_price || productData?.original_price || 0);

                // Delivery Lifecycle Tracking Pills
                let statusBadge = null;
                if (!isItemInStock) {
                  statusBadge = null;
                } else if (item.status === 'delivered') {
                  statusBadge = <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full">✅ Delivered</span>;
                } else if (item.status === 'out_for_delivery') {
                  statusBadge = <span className="text-[10px] font-bold bg-blue-100 text-blue-800 px-2.5 py-1 rounded-full animate-pulse">🚴 Out for Delivery</span>;
                } else if (item.status === 'pending' || item.status === 'confirmed' || item.status === 'scheduled') {
                  statusBadge = <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">⏳ Scheduled</span>;
                } else {
                  statusBadge = <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full border border-amber-100">⏳ Scheduled</span>;
                }

                return (
                  <div key={item.id} className={`bg-white p-4 rounded-3xl border flex items-center justify-between shadow-sm transition-all ${!isItemInStock ? 'opacity-60 bg-stone-50 border-stone-200' : 'border-stone-200 hover:shadow-md'}`}>
                    <div className="flex items-center space-x-4">
                      <div className="w-14 h-14 bg-stone-100 rounded-2xl overflow-hidden flex items-center justify-center font-bold text-stone-400 text-2xl shadow-inner border border-stone-200/50 min-w-[56px]">
                        <img 
                          src={productData?.image_url || productData?.images?.[0] || ''} 
                          alt="Product" 
                          className="w-12 h-12 rounded-xl object-cover bg-stone-100"
                          onError={(e) => {
                            e.currentTarget.onerror = null; 
                            e.currentTarget.src = '';
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

                    <div className="flex flex-col items-end space-y-2">
                      {!isItemInStock ? (
                        <span className="text-[10px] font-extrabold text-red-600 bg-red-50 p-2 rounded-xl border border-red-200 text-right max-w-[140px] leading-tight">
                          ⚠️ Out of Stock - We are sorry, couldn't deliver.
                        </span>
                      ) : (
                        <div className="flex items-center border border-stone-200 rounded-xl overflow-hidden h-9 bg-stone-50 shadow-sm">
                          <button
                            disabled={actionLoading}
                            onClick={() => handleQuantityChange(item, -1)}
                            className="px-3.5 hover:bg-stone-200 font-extrabold text-stone-600 transition-colors disabled:opacity-50"
                          >-</button>
                          <span className="px-1 min-w-[24px] text-center text-sm font-extrabold text-stone-800">{item.quantity}</span>
                          <button
                            disabled={actionLoading}
                            onClick={() => handleQuantityChange(item, 1)}
                            className="px-3.5 hover:bg-stone-200 font-extrabold text-stone-600 transition-colors disabled:opacity-50"
                          >+</button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* BOTTOM MODULE: ADD-ON CATALOG DISCOVERY GRID */}
        {!loading && availableAddons.length > 0 && (
          <section className="pt-6 border-t border-stone-200/60">
            <h3 className="text-sm font-bold text-stone-800 tracking-tight mb-4 flex items-center">
              ✨ Add More Items to This Delivery
            </h3>
            <div className="grid grid-cols-2 gap-3">
              {availableAddons.map(product => (
                <div key={product.id} className={`p-3 rounded-2xl border border-stone-200/80 shadow-sm flex flex-col justify-between transition-all ${product.out_of_stock_subscriptions ? 'opacity-60 bg-stone-50' : 'bg-white hover:shadow-md'}`}>
                  <div className="w-full h-24 bg-stone-50 rounded-xl mb-3 flex items-center justify-center overflow-hidden border border-stone-100">
                    <img 
                      src={product.image_url || product.images?.[0] || ''} 
                      alt="Product" 
                      className="w-12 h-12 rounded-xl object-cover bg-stone-100"
                      onError={(e) => {
                        e.currentTarget.onerror = null; 
                        e.currentTarget.src = '';
                      }}
                    />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-[13px] font-bold text-stone-800 leading-tight mb-1">{product.name}</h4>
                    <p className="text-xs font-bold text-stone-700 mt-1">
                      ₹{product.discounted_price || product.original_price || 0}
                    </p>
                  </div>
                  {product.out_of_stock_subscriptions ? (
                    <div className="mt-3 w-full py-2 bg-stone-100 text-stone-500 font-extrabold text-xs rounded-xl border border-stone-200 flex items-center justify-center shadow-inner select-none">
                      Temporarily Unavailable
                    </div>
                  ) : (
                    <button
                      disabled={actionLoading || product.stock_quantity <= 0}
                      onClick={() => handleAddOneTimeItem(product.slug)}
                      className="mt-3 w-full py-2 bg-stone-900 text-amber-400 font-bold text-xs rounded-xl hover:bg-stone-800 transition-colors disabled:opacity-50 flex items-center justify-center space-x-1 shadow-sm"
                    >
                      <span className="text-sm leading-none">+</span>
                      <span>Add</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

      </div>
    </div>
  );
};

export default HorizontalCalendarLedger;
