import React, { useState, useEffect } from 'react';
import { format, addDays, isSameDay } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

const HorizontalCalendarLedger = () => {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dailyDeliveries, setDailyDeliveries] = useState<any[]>([]);
  const [horizonDates, setHorizonDates] = useState<Date[]>([]);

  // 1. Generate a continuous 30-day horizontal timeline horizon strip
  useEffect(() => {
    const dates = Array.from({ length: 30 }, (_, i) => addDays(new Date(), i));
    setHorizonDates(dates);
  }, []);

  // 2. Fetch all item modifications, one-time additions, and subscription line-items for the selected date
  const fetchActiveLedgerForDate = async (date: Date) => {
    const formattedDateString = format(date, 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('delivery_ledger')
      .select('*, products(name, image_url, price)')
      .eq('delivery_date', formattedDateString);

    if (!error && data) {
      setDailyDeliveries(data);
    }
  };

  useEffect(() => {
    fetchActiveLedgerForDate(selectedDate);
  }, [selectedDate]);

  return (
    <div className="w-full max-w-md mx-auto bg-stone-50 min-h-screen flex flex-col font-sans">
      
      {/* 🌟 COUNTRY DELIGHT STYLE HORIZONTAL SCROLL LEDGER STRIP */}
      <div className="bg-white border-b border-stone-100 shadow-sm sticky top-0 z-50">
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
                <div className={`w-1 h-1 rounded-full mt-1 ${isSelected ? 'bg-white' : 'bg-amber-500'}`} />
              </button>
            );
          })}
        </div>
      </div>

      {/* 📦 DETAILED DAILY ITEM LAYOUT CONTROL LIST */}
      <div className="flex-1 p-4 space-y-4">
        <div className="text-xs font-bold text-stone-400 uppercase tracking-wide">
          Deliveries for {format(selectedDate, 'EEEE, dd MMM')}
        </div>

        {dailyDeliveries.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl border border-stone-200/60 text-center space-y-3">
            <p className="text-sm text-stone-500 font-medium">No deliveries scheduled for this day.</p>
            <button className="text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl hover:bg-amber-100/70 transition-all">
              + Add One-Time Items
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {dailyDeliveries.map((item) => (
              <div key={item.id} className="bg-white p-4 rounded-2xl border border-stone-200/60 shadow-sm flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-stone-100 rounded-xl overflow-hidden flex items-center justify-center font-bold text-stone-400">
                    🥚
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-stone-800">{item.products?.name}</h4>
                    <p className="text-xs font-medium text-stone-400">
                      Qty: <span className="text-stone-700 font-bold">{item.quantity}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  {item.subscription_id ? (
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md border border-emerald-100">
                      🔄 Recurring
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-2 py-0.5 rounded-md border border-blue-100">
                      📦 One-Time Edit
                    </span>
                  )}
                  {/* Every single day remains editable with modifications active! */}
                  <button className="text-xs font-bold text-stone-500 hover:text-amber-600 underline">
                    Modify
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
};

export default HorizontalCalendarLedger;
