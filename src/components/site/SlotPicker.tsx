import { useMemo } from "react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Loader2, Clock, XCircle, Check } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  selectedSlotId?: string;
  onSelect: (date: Date, slotId: string) => void;
};

const SlotPicker = ({ selectedSlotId, onSelect }: Props) => {
  // Same-day only: Today is the fixed target
  const today = new Date();

  const { data: dbSlots, isLoading } = useQuery({
    queryKey: ['delivery-slots-config'],
    queryFn: async () => {
      const { data, error } = await (supabase.from('delivery_slots') as any)
        .select('*')
        .eq('is_active', true)
        .order('cutoff_time', { ascending: true });
      if (error) throw error;
      return (data || []) as any[];
    }
  });

  const availableSlotsForToday = useMemo(() => {
    if (!dbSlots) return [];
    
    // Get current time in HH:mm:ss format for string comparison with DB TIME column
    const now = new Date();
    const currentLocalTimeStr = format(now, "HH:mm:ss");

    return dbSlots.map((slot: any) => ({
      ...slot,
      closed: currentLocalTimeStr >= slot.cutoff_time
    }));
  }, [dbSlots]);

  const hasAnySlot = useMemo(() => {
    return availableSlotsForToday.some((s: any) => !s.closed);
  }, [availableSlotsForToday]);

  if (isLoading) return <div className="p-8 grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (!hasAnySlot && dbSlots && dbSlots.length > 0) {
    return (
      <div className="p-6 bg-amber-50 rounded-2xl border border-dashed border-amber-200 text-center space-y-3">
        <XCircle className="w-10 h-10 text-amber-500 mx-auto opacity-50" />
        <div>
          <h3 className="font-display font-bold text-amber-900 text-base">⚠️ Sold Out for Today</h3>
          <p className="text-[11px] text-amber-700 leading-tight mt-1">
            All delivery shifts for today have departed. Please check back tomorrow morning to secure your fresh batch!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="px-1">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="w-4 h-4 text-primary" />
          <span className="font-display font-bold text-sm text-brown">Today's Delivery Windows</span>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Same-Day Express Only</p>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {availableSlotsForToday.map((slot: any) => {
          const isSelected = selectedSlotId === slot.slot_key;
          const closed = slot.closed;

          return (
            <button
              key={slot.id}
              disabled={closed}
              onClick={() => onSelect(today, slot.slot_key)}
              className={`flex items-center justify-between p-4 rounded-2xl border transition-all ${
                closed 
                  ? "bg-secondary/20 border-dashed opacity-60 grayscale cursor-not-allowed" 
                  : isSelected 
                    ? "border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20" 
                    : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full grid place-items-center ${closed ? "bg-muted" : "bg-primary/10"}`}>
                  <Clock className={`w-5 h-5 ${closed ? "text-muted-foreground" : "text-primary"}`} />
                </div>
                <div className="text-left">
                  <div className={`font-display font-bold text-sm ${closed ? "text-muted-foreground line-through" : "text-brown"}`}>
                    {slot.label}
                  </div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-tight">
                    {closed ? "Shift Closed" : `Cutoff: ${slot.cutoff_time.slice(0, 5)}`}
                  </div>
                </div>
              </div>
              {closed ? (
                <Badge variant="outline" className="text-[10px] font-bold text-muted-foreground border-muted-foreground/30 px-2 py-0">
                  Closed
                </Badge>
              ) : isSelected && (
                <div className="w-6 h-6 rounded-full bg-primary grid place-items-center animate-in zoom-in-50">
                  <Check className="w-3.5 h-3.5 text-brown" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default SlotPicker;
