import { createContext, useContext, useEffect, useState, useMemo, ReactNode } from "react";
import { toast } from "sonner";
import { Coupon } from "@/hooks/useCoupons";
import { Offer } from "@/hooks/useOffers";

export type Product = {
  id: string;
  name: string;
  benefit?: string | null;
  description?: string | null;
  price: number;
  discountPrice: number;
  image: string;
  images?: string[];
  unit?: string | null;
  slug?: string;
  stock_quantity?: number;
};

export type CartItem = Product & { 
  qty: number;
  purchase_type: 'instant' | 'subscription';
  subscription_days?: number[];
  delivery_slot_id?: string;
  frequency_type?: 'daily' | 'alternate' | 'weekly' | 'custom_days';
};

// Result of the offer evaluation engine
export type OfferResult = {
  isDeliveryFree: boolean;
  discountAmount: number;
  bonusProductSlug?: string | null;
};

type CartCtx = {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (p: Product, type?: 'instant' | 'subscription', days?: number[], silent?: boolean) => void;
  remove: (id: string, type?: 'instant' | 'subscription') => void;
  inc: (id: string, type?: 'instant' | 'subscription') => void;
  dec: (id: string, type?: 'instant' | 'subscription') => void;
  clear: () => void;
  total: number;
  count: number;
  // Coupon
  appliedCoupon: Coupon | null;
  setAppliedCoupon: (c: Coupon | null) => void;
  discount: number;
  grandTotal: number;
  // Offer engine
  activeOffer: Offer | null;
  setActiveOffer: (o: Offer | null) => void;
  offerResult: OfferResult;
  evaluateOffer: (offer: Offer, cartSlugs: string[]) => OfferResult;
  // Address
  selectedAddressId: string;
  setSelectedAddressId: (id: string) => void;
  updateItems: (items: CartItem[]) => void;
};

const Ctx = createContext<CartCtx | null>(null);

const DEFAULT_OFFER_RESULT: OfferResult = { isDeliveryFree: false, discountAmount: 0, bonusProductSlug: null };

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { 
      const raw = localStorage.getItem("cart");
      if (!raw) return [];
      const parsed = JSON.parse(raw) as any[];
      // Migrate legacy items: Ensure every item has a purchase_type
      return parsed.map(i => ({
        ...i,
        purchase_type: i.purchase_type || 'instant'
      }));
    } catch { return []; }
  });
  const [open, setOpen] = useState(false);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [activeOffer, setActiveOffer] = useState<Offer | null>(null);
  const [selectedAddressId, setSelectedAddressId] = useState("");

  useEffect(() => { localStorage.setItem("cart", JSON.stringify(items)); }, [items]);

  const add = (
    p: Product & { frequency_type?: 'daily' | 'alternate' | 'weekly' | 'custom_days' }, 
    type: 'instant' | 'subscription' = 'instant', 
    days: number[] = [1, 3, 5], 
    silent = false
  ) => {
    setItems(prev => {
      if (type === 'subscription') {
        // Enforce Strict Single-Subscription Cart Ceiling: delete any other subscription item
        const filteredPrev = prev.filter(i => i.purchase_type !== 'subscription');
        const exists = filteredPrev.find(i => i.id === p.id && i.purchase_type === type);
        
        if (exists) {
          return filteredPrev.map(i => (i.id === p.id && i.purchase_type === 'subscription') 
            ? { ...i, qty: i.qty + 1 } 
            : i
          );
        }
        return [...filteredPrev, { ...p, qty: 1, purchase_type: 'subscription', subscription_days: days, frequency_type: p.frequency_type }];
      } else {
        // INSTANT PATH
        const exists = prev.find(i => i.id === p.id && (i.purchase_type || 'instant') === 'instant');
        if (exists) {
          if (p.stock_quantity !== undefined && exists.qty >= p.stock_quantity) {
            toast.error(`Only ${p.stock_quantity} available in stock`);
            return prev;
          }
          return prev.map(i => (i.id === p.id && (i.purchase_type || 'instant') === 'instant') 
            ? { ...i, qty: i.qty + 1 } 
            : i
          );
        }
        if (p.stock_quantity !== undefined && p.stock_quantity <= 0) {
          toast.error("Item is out of stock");
          return prev;
        }
        return [...prev, { ...p, qty: 1, purchase_type: 'instant' }];
      }
    });
    if (!silent) toast.success(`${p.name} added to cart`);
  };

  const remove = (id: string, type: 'instant' | 'subscription' = 'instant') => 
    setItems(prev => prev.filter(i => !(i.id === id && (i.purchase_type || 'instant') === type)));

  const inc = (id: string, type: 'instant' | 'subscription' = 'instant') => 
    setItems(prev => prev.map(i => {
      if (i.id === id && (i.purchase_type || 'instant') === type) {
        if (i.stock_quantity !== undefined && i.qty >= i.stock_quantity) {
          toast.error(`Only ${i.stock_quantity} available in stock`);
          return i;
        }
        return { ...i, qty: i.qty + 1 };
      }
      return i;
    }));

  const dec = (id: string, type: 'instant' | 'subscription' = 'instant') => 
    setItems(prev => prev.flatMap(i => (i.id === id && (i.purchase_type || 'instant') === type) ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]));

  const clear = () => { setItems([]); setAppliedCoupon(null); setActiveOffer(null); };
  const updateItems = (newItems: CartItem[]) => setItems(newItems);

  const total = useMemo(() => {
    return items.reduce((s, i) => {
      if (i.purchase_type === 'subscription') {
        const deliveryMultiplier = i.frequency_type === 'weekly' ? 4 : (i.frequency_type === 'alternate' ? 15 : 30);
        return s + (i.discountPrice * i.qty * deliveryMultiplier);
      }
      return s + i.discountPrice * i.qty;
    }, 0);
  }, [items]);
  const count = items.reduce((s, i) => s + i.qty, 0);

  // Offer evaluation engine
  const evaluateOffer = (offer: Offer, cartSlugs: string[]): OfferResult => {
    const subtotal = total;
    const result: OfferResult = { isDeliveryFree: false, discountAmount: 0, bonusProductSlug: null };

    if (offer.offer_type === "free_delivery" && subtotal >= (offer.min_order_value || 0)) {
      result.isDeliveryFree = true;
    }

    if (offer.offer_type === "product_free" && subtotal >= (offer.min_order_value || 0)) {
      result.bonusProductSlug = offer.reward_product_slug;
    }

    if (offer.offer_type === "bundle_buy") {
      const required = offer.required_product_slugs || [];
      const hasAll = required.length > 0 && required.every(slug => cartSlugs.includes(slug));
      if (hasAll) {
        result.discountAmount = Math.round(subtotal * 0.1); // 10% bundle default
      }
    }

    return result;
  };

  const cartSlugs = useMemo(() => items.map(i => i.slug || ""), [items]);

  const offerResult = useMemo<OfferResult>(() => {
    if (!activeOffer) return DEFAULT_OFFER_RESULT;
    return evaluateOffer(activeOffer, cartSlugs);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOffer, total, cartSlugs]);

  // Coupon discount (product_discount via coupon)
  const discount = useMemo(() => {
    // If active offer is product_discount type, it applies via coupon
    const couponDiscount = (() => {
      if (!appliedCoupon) return 0;
      if (total < (appliedCoupon.min_order_amount || 0)) {
        setAppliedCoupon(null);
        toast.error(`Coupon removed: cart total fell below minimum`);
        return 0;
      }
      if (appliedCoupon.discount_type === "percent") {
        return Math.round((total * (appliedCoupon.discount_value || 0)) / 100);
      }
      return appliedCoupon.discount_value || 0;
    })();
    return couponDiscount + offerResult.discountAmount;
  }, [appliedCoupon, total, offerResult.discountAmount]);

  const grandTotal = Math.max(0, total - discount);

  return (
    <Ctx.Provider value={{
      items, open, setOpen, add, remove, inc, dec, clear,
      total, count,
      appliedCoupon, setAppliedCoupon, discount, grandTotal,
      activeOffer, setActiveOffer, offerResult, evaluateOffer,
      selectedAddressId, setSelectedAddressId,
      updateItems,
    }}>
      {children}
    </Ctx.Provider>
  );
};

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};
