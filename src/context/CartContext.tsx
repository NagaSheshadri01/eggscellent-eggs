import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";

export type Product = {
  id: string;
  name: string;
  benefit?: string | null;
  price: number;          // original
  discountPrice: number;  // discounted
  image: string;
  unit?: string | null;
  slug?: string;
};

export type CartItem = Product & { qty: number };

type CartCtx = {
  items: CartItem[];
  open: boolean;
  setOpen: (v: boolean) => void;
  add: (p: Product, silent?: boolean) => void;
  remove: (id: string) => void;
  inc: (id: string) => void;
  dec: (id: string) => void;
  clear: () => void;
  total: number;
  count: number;
};

const Ctx = createContext<CartCtx | null>(null);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem("cart") || "[]"); } catch { return []; }
  });
  const [open, setOpen] = useState(false);

  useEffect(() => { localStorage.setItem("cart", JSON.stringify(items)); }, [items]);

  const add = (p: Product, silent = false) => {
    setItems(prev => {
      const found = prev.find(i => i.id === p.id);
      if (found) return prev.map(i => i.id === p.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...p, qty: 1 }];
    });
    if (!silent) toast.success(`${p.name} added to cart`);
  };
  const remove = (id: string) => setItems(prev => prev.filter(i => i.id !== id));
  const inc = (id: string) => setItems(prev => prev.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i));
  const dec = (id: string) => setItems(prev => prev.flatMap(i => i.id === id ? (i.qty > 1 ? [{ ...i, qty: i.qty - 1 }] : []) : [i]));
  const clear = () => setItems([]);

  const total = items.reduce((s, i) => s + i.discountPrice * i.qty, 0);
  const count = items.reduce((s, i) => s + i.qty, 0);

  return (
    <Ctx.Provider value={{ items, open, setOpen, add, remove, inc, dec, clear, total, count }}>
      {children}
    </Ctx.Provider>
  );
};

export const useCart = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error("useCart must be inside CartProvider");
  return c;
};
