import { useState, useRef, useEffect } from "react";
import { Navigation, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PartnerOrderCardProps {
  groupedStop: {
    userId: string;
    customerInfo?: {
      full_name?: string;
      phone?: string;
    };
    address?: {
      address_line_1?: string;
      pincode?: string;
      lat?: number;
      lng?: number;
    };
    items: Array<{
      id: string;
      bill_id: string;
      status: string;
      delivery_date: string;
      custom_order_id?: string;
      effective_price?: number;
      subscriptions?: {
        product_slug: string;
        quantity: number;
      };
    }>;
    master_order_id: string;
    custom_order_id: string;
  };
  productsList: any[];
  onConfirmDelivery: () => Promise<void>;
  onLogIssue: (itemId: string) => void;
  isLocked?: boolean;
}

export const PartnerOrderCard = ({
  groupedStop,
  productsList,
  onConfirmDelivery,
  onLogIssue,
  isLocked = false
}: PartnerOrderCardProps) => {
  const addr = groupedStop.address || {};
  const profile = groupedStop.customerInfo || {};
  const items = groupedStop.items || [];

  // Consider it delivered if all items in the stop are marked as delivered
  const isDelivered = items.every((item: any) => item.status === "delivered");

  // Slider State
  const [sliderVal, setSliderVal] = useState(0);
  const [isSliding, setIsSliding] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const navUrl = addr.lat && addr.lng
    ? `https://www.google.com/maps/dir/?api=1&destination=${addr.lat},${addr.lng}&travelmode=driving`
    : null;

  // Handle Dragging / Sliding
  const handleStart = () => {
    if (isLocked) return;
    setIsSliding(true);
  };

  const handleMove = (clientX: number) => {
    if (!isSliding || !trackRef.current || isLocked) return;
    const rect = trackRef.current.getBoundingClientRect();
    const width = rect.width - 48; // thumb width is 48px
    const relativeX = clientX - rect.left - 24;
    const percentage = Math.min(Math.max(0, (relativeX / width) * 100), 100);
    setSliderVal(percentage);
  };

  const handleEnd = () => {
    if (!isSliding || isLocked) return;
    setIsSliding(false);
    if (sliderVal >= 90) {
      // Completed Swipe
      setSliderVal(100);
      onConfirmDelivery();
    } else {
      // Snap back
      setSliderVal(0);
    }
  };

  // Listeners for window to prevent mouse-release-outside-slider bugs
  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (isSliding) {
        handleMove(e.touches[0].clientX);
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isSliding) {
        handleMove(e.clientX);
      }
    };
    const onEnd = () => {
      handleEnd();
    };

    window.addEventListener("touchmove", onTouchMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onEnd);

    return () => {
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onEnd);
    };
  }, [isSliding, sliderVal]);

  // Ensure touch scrolling is not blocked when not sliding


  return (
    <div className="bg-card rounded-2xl shadow-soft p-5 border border-border/50 space-y-4 hover:shadow-card transition-smooth">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="font-display font-extrabold text-brown text-base">
            {profile.full_name || "Customer"}
          </span>
        </div>
        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-primary/10 text-brown">
          Prepaid Wallet
        </span>
      </div>

      {/* Address Details */}
      <div className="space-y-1 py-3 border-y border-border/30">
        <div className="flex gap-2.5 items-start text-xs">
          <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <div className="text-slate-600 font-medium leading-relaxed">
            {addr.address_line_1 || "—"}, Pincode: {addr.pincode || ""}
          </div>
        </div>
      </div>

      {/* Giant Box ID Tracking Tag */}
      <div className="bg-stone-900 text-amber-400 font-mono text-xl font-black px-4 py-2 rounded-lg tracking-widest border border-stone-800 shadow-md flex items-center justify-center gap-2">
        📦 BOX ID: <span className="text-white font-mono">{groupedStop.custom_order_id}</span>
      </div>

      {/* Manifest Contents */}
      <div className="flex flex-col gap-3 p-3 bg-stone-50 rounded-xl border border-stone-100">
        <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1">
          📦 Manifest Contents ({items.length} items)
        </span>
        <div className="space-y-3">
          {items.map((item: any) => {
            const matchingProduct = productsList.find((p: any) => p.slug === (item.subscriptions?.product_slug || item.product_slug));
            const productName = matchingProduct?.name || item.subscriptions?.product_slug || "Premium Eggs";
            const quantity = item.subscriptions?.quantity || item.quantity || 1;
            const effectivePrice = item.effective_price || matchingProduct?.discounted_price || 150.00;
            const totalCost = effectivePrice * quantity;
            
            return (
              <div key={item.id} className="flex flex-col gap-1 pb-2.5 border-b border-stone-200/50 last:border-0 last:pb-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-stone-800">
                    {productName} × {quantity} Packs
                  </span>
                </div>
                <span className="text-xs text-stone-400">
                  Rate: ₹{effectivePrice.toFixed(2)} (Total: ₹{totalCost.toFixed(2)})
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3 pt-2">
        {navUrl && (
          <a href={navUrl} target="_blank" rel="noreferrer" className="block">
            <Button variant="outline" className="w-full h-10 border-blue-200 text-blue-600 hover:bg-blue-50 font-bold rounded-xl text-xs">
              <Navigation className="w-3.5 h-3.5 mr-1.5" /> Navigate Stop
            </Button>
          </a>
        )}

        {isLocked ? (
          <div className="flex justify-center pt-2">
            <div className="bg-stone-100 text-stone-500 text-xs font-medium px-3 py-1.5 rounded-lg border border-stone-200 inline-flex items-center gap-1.5">
              🔒 Locked Until Tomorrow
            </div>
          </div>
        ) : (
          <>
            {/* Swipe to confirm delivery slider */}
            {!isDelivered ? (
              <div 
                ref={trackRef}
                className="relative h-12 bg-stone-100 border border-stone-200 rounded-full overflow-hidden select-none"
              >
                {/* Slide Track Label Text */}
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-bold text-stone-500 pointer-events-none uppercase tracking-wider">
                  {sliderVal > 90 ? "Release to confirm Drop-off" : "Swipe right to confirm drop-off →"}
                </div>

                {/* Slide Progress Fill */}
                <div 
                  className="absolute left-0 top-0 bottom-0 bg-primary/20 transition-all duration-75"
                  style={{ width: `${sliderVal}%` }}
                />

                {/* Egg-yolk Gold Thumb Button */}
                <div
                  className="absolute top-0.5 bottom-0.5 w-11 rounded-full gradient-yolk shadow-md flex items-center justify-center cursor-grab active:cursor-grabbing transition-all duration-75"
                  style={{ 
                    left: `calc(${sliderVal}% * (100% - 44px) / 100 + 2px)`,
                  }}
                  onMouseDown={handleStart}
                  onTouchStart={handleStart}
                >
                  <span className="text-white text-base select-none">🍳</span>
                </div>
              </div>
            ) : (
              <div className="w-full h-11 bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold rounded-xl flex items-center justify-center text-xs">
                ✓ Delivered Successfully
              </div>
            )}

            {/* Log Issue Button */}
            {!isDelivered && (
              <button
                onClick={() => onLogIssue(items[0]?.id)}
                className="w-full text-center text-stone-400 hover:text-stone-600 text-xs font-semibold hover:underline block pt-1"
              >
                ⚠️ Log Delivery Issue
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
};
