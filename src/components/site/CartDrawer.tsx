import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

const CartDrawer = () => {
  const { items, open, setOpen, inc, dec, remove, total, count } = useCart();
  const nav = useNavigate();
  const checkout = () => {
    setOpen(false);
    nav("/checkout");
  };
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col p-0 bg-background">
        <SheetHeader className="px-5 py-4 border-b border-border">
          <SheetTitle className="font-display text-brown text-xl flex items-center gap-2">
            <ShoppingBag className="w-5 h-5" /> Your Cart {count > 0 && <span className="text-sm text-muted-foreground font-body font-normal">({count})</span>}
          </SheetTitle>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 grid place-items-center text-center px-6">
            <div>
              <div className="w-20 h-20 mx-auto rounded-full bg-secondary grid place-items-center mb-4">
                <ShoppingBag className="w-8 h-8 text-brown/60" />
              </div>
              <p className="font-display font-semibold text-brown">Your cart is empty</p>
              <p className="text-sm text-muted-foreground mt-1">Add some farm-fresh eggs to get started.</p>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.map(i => (
                <div key={i.id} className="flex gap-3 bg-card rounded-2xl p-3 shadow-soft">
                  <img src={i.image} alt={i.name} className="w-16 h-16 rounded-xl object-cover" />
                  <div className="flex-1 min-w-0">
                    <div className="font-display font-semibold text-brown text-sm leading-tight">{i.name}</div>
                    <div className="text-xs text-muted-foreground">{i.unit}</div>
                    <div className="font-display font-bold text-brown text-sm mt-1">₹{i.discountPrice * i.qty}</div>
                  </div>
                  <div className="flex flex-col items-end justify-between">
                    <button onClick={() => remove(i.id)} className="text-muted-foreground hover:text-destructive transition-smooth"><Trash2 className="w-4 h-4" /></button>
                    <div className="flex items-center gap-1 bg-secondary rounded-lg p-0.5">
                      <button onClick={() => dec(i.id)} className="w-7 h-7 grid place-items-center rounded-md hover:bg-card text-brown"><Minus className="w-3.5 h-3.5" /></button>
                      <span className="text-sm font-semibold text-brown w-5 text-center">{i.qty}</span>
                      <button onClick={() => inc(i.id)} className="w-7 h-7 grid place-items-center rounded-md hover:bg-card text-brown"><Plus className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-border bg-card p-5 space-y-3">
              <div className="flex justify-between text-sm text-muted-foreground"><span>Subtotal</span><span>₹{total}</span></div>
              <div className="flex justify-between text-sm text-muted-foreground"><span>Delivery</span><span className="text-success font-semibold">{total >= 199 ? "FREE" : "₹29"}</span></div>
              <div className="flex justify-between font-display font-bold text-brown text-lg pt-2 border-t border-border"><span>Total</span><span>₹{total + (total >= 199 ? 0 : 29)}</span></div>
              <Button variant="hero" size="lg" className="w-full" onClick={checkout}>Checkout</Button>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
