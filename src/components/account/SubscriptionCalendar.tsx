import React, { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { useDeliveryCalendar } from "@/hooks/useDeliveryCalendar";
import { useProducts } from "@/hooks/useProducts";
import { Plus, Minus, X } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const HorizontalCalendarLedger = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [horizonDates, setHorizonDates] = useState<Date[]>([]);
  const [isMarketplaceOpen, setIsMarketplaceOpen] = useState(false);

  // Use the global delivery calendar hook to access mutation and cached state
  const { data: ledger = [], updateVolume, addStandaloneItem } = useDeliveryCalendar();
  const { data: products = [] } = useProducts({ onlyActive: true });

  // 1. Generate a continuous 30-day horizontal timeline horizon strip
  useEffect(() => {
    const dates = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));
    setHorizonDates(dates);
  }, []);

  // Compute daily deliveries from the global ledger based on selectedDate
  const formattedDateString = format(selectedDate, 'yyyy-MM-dd');
  const dailyDeliveries = ledger.filter((item: any) => item.delivery_date === formattedDateString && item.status !== 'cancelled');

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
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStandalone = async (product_slug: string, price: number) => {
    try {
      await addStandaloneItem.mutateAsync({
        date: formattedDateString,
        product_slug,
        price: price
      });
      setIsMarketplaceOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-stone-50 min-h-screen flex flex-col font-sans relative">
      
      {/* 🌟 COUNTRY DELIGHT STYLE HORIZONTAL SCROLL LEDGER STRIP */}
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-40">
        <div className="p-4 pb-2 flex justify-between items-center">
          <h2 className="text-base font-bold text-stone-800">Your Delivery Schedule</h2>
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
            {format(selectedDate, 'MMMM yyyy')}
          </span>
        </div>

        {/* Scrollable Date Track */}
        <div className="flex overflow-x-auto px-4 pb-4 space-x-3 scrollbar-none snap-x">
          {horizonDates.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
            // Check if there are active deliveries for this day in the ledger
            const dateStr = format(date, 'yyyy-MM-dd');
            const hasDeliveries = ledger.some((item: any) => item.delivery_date === dateStr && item.status !== 'cancelled');

            return (
              <button
                key={idx}
                onClick={() => setSelectedDate(date)}
                className={`flex flex-col items-center justify-center min-w-[54px] h-[72px] rounded-2xl transition-all snap-center border ${
                  isSelected
                    ? 'bg-amber-500 border-amber-500 text-white shadow-md shadow-amber-500/20 scale-105'
                    : 'bg-stone-50 border-stone-200/60 text-stone-700 hover:border-stone-300'
                }`}
              >
                <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? 'text-amber-100' : 'text-stone-400'}`}>
                  {format(date, 'EEE')}
                </span>
                <span className="text-lg font-extrabold mt-0.5">
                  {format(date, 'd')}
                </span>
                {/* Visual tiny indicator dot if deliveries are scheduled on this day */}
                {hasDeliveries ? (
                  <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-amber-500'}`} />
                ) : (
                  <div className="w-1 h-1 rounded-full mt-1 bg-transparent" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 📦 DETAILED DAILY ITEM LAYOUT CONTROL LIST */}
      <div className="flex-1 p-4 space-y-4">
        <div className="text-xs font-bold text-stone-400 uppercase tracking-wide flex justify-between items-center">
          <span>Deliveries for {format(selectedDate, 'EEEE, dd MMM')}</span>
          {dailyDeliveries.length > 0 && (
             <button 
               onClick={() => setIsMarketplaceOpen(true)}
               className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg hover:bg-amber-100/70 transition-all"
             >
               + Add
             </button>
          )}
        </div>

        {dailyDeliveries.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-stone-200/60 text-center space-y-3">
            <p className="text-sm text-stone-500 font-medium">No deliveries scheduled for this day.</p>
            <button 
              onClick={() => setIsMarketplaceOpen(true)}
              className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl hover:bg-amber-100/70 transition-all"
            >
              + Add One-Time Items
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dailyDeliveries.map((item: any) => {
                 const pDetails = products.find((p: any) => p.slug === item.product_slug);
                 const name = item.products?.name || pDetails?.name || item.product_slug;
                 const imageUrl = item.products?.image_url || pDetails?.image_url;
                 const isItemInStock = item.products?.is_in_stock !== false && pDetails?.is_in_stock !== false;
                 
                 return (
                  <div key={item.id || item.product_slug} className={`bg-white p-4 rounded-2xl border flex items-center justify-between ${!isItemInStock ? 'opacity-50 bg-stone-100 border-stone-200' : 'border-stone-200/60 shadow-sm'}`}>
                    <div className="flex items-center space-x-3">
                      <div className="w-12 h-12 bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center font-bold text-stone-400">
                        {imageUrl ? <img src={imageUrl} alt={name} className="w-full h-full object-cover" /> : "🥚"}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-stone-800 capitalize">{name}</h4>
                        <p className="text-[10px] font-mono text-stone-500">₹{item.effective_price?.toFixed(2)} / unit</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      {item.subscription_id ? (
                        <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                          🔄 Recurring
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                          📦 One-Time Edit
                        </span>
                      )}
                      
                      {!isItemInStock ? (
                        <span className="text-xs font-extrabold text-red-500 bg-red-50 px-3 py-1 rounded-lg border border-red-100">
                          Out of Stock
                        </span>
                      ) : (
                        <div className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl p-1 shadow-sm shrink-0">
                          <button 
                            onClick={() => handleUpdateVolume(item, -1)} 
                            disabled={updateVolume.isPending || item.quantity <= 0} 
                            className="w-6 h-6 grid place-items-center rounded-lg hover:bg-stone-200 text-stone-700 disabled:opacity-50 transition-colors"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold w-4 text-center">{item.quantity}</span>
                          <button 
                            onClick={() => handleUpdateVolume(item, 1)} 
                            disabled={updateVolume.isPending} 
                            className="w-6 h-6 grid place-items-center rounded-lg hover:bg-stone-200 text-stone-700 transition-colors"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* Slide-over Marketplace Panel */}
      {isMarketplaceOpen && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end bg-stone-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white w-full max-w-md mx-auto rounded-t-3xl p-5 shadow-2xl animate-in slide-in-from-bottom flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 pb-3 border-b border-stone-100">
              <div>
                <h3 className="font-bold text-stone-800">Add to Delivery</h3>
                <p className="text-[10px] font-bold text-amber-600 tracking-wider uppercase mt-0.5">
                  {format(selectedDate, 'EEEE, dd MMM yyyy')}
                </p>
              </div>
              <button 
                onClick={() => setIsMarketplaceOpen(false)}
                className="w-8 h-8 rounded-full bg-stone-100 grid place-items-center text-stone-500 hover:bg-stone-200 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="overflow-y-auto space-y-3 pb-6 flex-1 scrollbar-none">
              {products
                .filter((p: any) => !dailyDeliveries.some((item: any) => item.product_slug === p.slug))
                .map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between bg-stone-50 rounded-2xl p-3 border border-stone-200/60 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white rounded-xl overflow-hidden border border-stone-100">
                         {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <div className="w-full h-full grid place-items-center text-stone-300 text-xs font-bold">🥚</div>}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-stone-800 capitalize">{p.name}</div>
                        <div className="text-[10px] text-stone-500 font-mono font-bold mt-0.5">
                          ₹{p.discounted_price.toFixed(2)}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddStandalone(p.slug, p.discounted_price)}
                      disabled={addStandaloneItem.isPending}
                      className="h-8 rounded-xl px-4 text-xs font-bold bg-stone-800 text-white hover:bg-stone-900 transition-colors shadow-sm disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
              ))}
              
              {products.length > 0 && products.filter((p: any) => !dailyDeliveries.some((item: any) => item.product_slug === p.slug)).length === 0 && (
                 <div className="text-center py-6 text-sm text-stone-400 font-medium">
                   All available products are already scheduled for this day! Modify their quantity instead.
                 </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default HorizontalCalendarLedger;
