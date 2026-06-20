import React, { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const HorizontalCalendarLedger = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyDeliveries, setDailyDeliveries] = useState<any[]>([]);
  const [horizonDates, setHorizonDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  // 1. Generate a continuous 30-day horizontal timeline strip
  useEffect(() => {
    const dates = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));
    setHorizonDates(dates);
  }, []);

  // 2. Fetch all item entries for the selected date using the newly formed product relationship
  const fetchActiveLedgerForDate = async (dateObject: Date) => {
    setLoading(true);
    try {
      const year = dateObject.getFullYear();
      const month = String(dateObject.getMonth() + 1).padStart(2, '0');
      const day = String(dateObject.getDate()).padStart(2, '0');
      const formattedDateString = `${year}-${month}-${day}`;
      
      // We pull products(*) via the newly established relational foreign key cache
      const { data, error } = await supabase
        .from('delivery_ledger')
        .select('id, quantity, delivery_date, subscription_id, product_slug, effective_price, status, products(*)') 
        .eq('delivery_date', formattedDateString);

      if (error) throw error;
      setDailyDeliveries(data || []);
    } catch (err: any) {
      console.error("Calendar fetch aborted:", err);
      toast.error(`Sync Error: ${err.message || 'Check connection details'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveLedgerForDate(selectedDate);
  }, [selectedDate]);

  return (
    <div className="w-full max-w-md mx-auto bg-stone-50 min-h-screen flex flex-col font-sans">
      
      {/* COUNTRY DELIGHT HORIZONTAL TRACK STRIP */}
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-50">
        <div className="p-4 pb-2 flex justify-between items-center">
          <h2 className="text-base font-bold text-stone-800">Your Delivery Schedule</h2>
          <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full">
            {format(selectedDate, 'MMMM yyyy')}
          </span>
        </div>

        <div className="flex overflow-x-auto px-4 pb-4 space-x-3 scrollbar-none snap-x">
          {horizonDates.map((date, idx) => {
            const isSelected = isSameDay(date, selectedDate);
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
                <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-amber-500'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* DETAILED LEDGER CONTROLS */}
      <div className="flex-1 p-4 space-y-4">
        <div className="text-xs font-bold text-stone-400 uppercase tracking-wide">
          Deliveries for {format(selectedDate, 'EEEE, dd MMM')}
        </div>

        {loading ? (
          <div className="text-center py-8 text-sm text-stone-400 font-medium">Updating list items...</div>
        ) : dailyDeliveries.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-stone-200/60 text-center space-y-3">
            <p className="text-sm text-stone-500 font-medium">No deliveries scheduled for this day.</p>
            <button className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl hover:bg-amber-100/70 transition-all">
              + Add One-Time Items
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dailyDeliveries.map((item) => {
              const productData = item.products;
              const isItemInStock = productData?.is_in_stock !== false;

              return (
                <div key={item.id} className={`bg-white p-4 rounded-2xl border flex items-center justify-between shadow-sm ${!isItemInStock ? 'opacity-50 bg-stone-100 border-stone-200' : 'border-stone-200/60'}`}>
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center font-bold text-stone-400 text-xl">
                      🥚
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-stone-800">{productData?.name || item.product_slug}</h4>
                      <p className="text-xs font-medium text-stone-400">
                        ₹{item.effective_price || productData?.price || 0} / unit
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end space-y-2">
                    {item.subscription_id ? (
                      <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                        🔄 Recurring
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                        📦 One-Time
                      </span>
                    )}

                    {!isItemInStock ? (
                      <span className="text-xs font-extrabold text-red-500 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100">
                        Out of Stock
                      </span>
                    ) : (
                      <div className="flex items-center border border-stone-200 rounded-lg overflow-hidden h-8 bg-white">
                        <button className="px-2.5 bg-stone-50 hover:bg-stone-100 font-bold text-stone-600 transition-colors">-</button>
                        <span className="px-3 text-xs font-bold text-stone-700">{item.quantity}</span>
                        <button className="px-2.5 bg-stone-50 hover:bg-stone-100 font-bold text-stone-600 transition-colors">+</button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default HorizontalCalendarLedger;
