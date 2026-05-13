import { useCart } from "@/context/CartContext";
import { Button } from "@/components/ui/button";
import { ShoppingBag } from "lucide-react";

const StickyCart = () => {
  const { count, total, setOpen } = useCart();
  if (count === 0) return null;
  return (
    <div className="fixed bottom-4 left-4 right-4 z-30 sm:hidden animate-fade-in">
      <Button variant="hero" size="lg" className="w-full justify-between shadow-yolk" onClick={() => setOpen(true)}>
        <span className="flex items-center gap-2"><ShoppingBag className="w-5 h-5" /> {count} item{count > 1 ? "s" : ""}</span>
        <span>₹{total} • View Cart</span>
      </Button>
    </div>
  );
};

export default StickyCart;
