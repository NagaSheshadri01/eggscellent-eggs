import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

type Props = {
  images: string[];
  initialIndex: number;
  open: boolean;
  onClose: () => void;
};

const ProductImageModal = ({ images, initialIndex, open, onClose }: Props) => {
  const [index, setIndex] = useState(initialIndex);

  useEffect(() => {
    if (open) {
      setIndex(initialIndex);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => { document.body.style.overflow = "unset"; };
  }, [open, initialIndex]);

  if (!open) return null;

  const next = () => setIndex((i) => (i + 1) % images.length);
  const prev = () => setIndex((i) => (i - 1 + images.length) % images.length);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-300">
      <button 
        onClick={onClose}
        className="absolute top-6 right-6 p-2 text-white/70 hover:text-white transition-colors z-[110]"
      >
        <X className="w-8 h-8" />
      </button>

      {images.length > 1 && (
        <>
          <button 
            onClick={prev}
            className="absolute left-4 sm:left-8 p-3 text-white/50 hover:text-white transition-colors z-[110] bg-white/5 rounded-full hover:bg-white/10"
          >
            <ChevronLeft className="w-10 h-10" />
          </button>
          <button 
            onClick={next}
            className="absolute right-4 sm:right-8 p-3 text-white/50 hover:text-white transition-colors z-[110] bg-white/5 rounded-full hover:bg-white/10"
          >
            <ChevronRight className="w-10 h-10" />
          </button>
        </>
      )}

      <div className="relative w-full h-full flex items-center justify-center p-4 sm:p-12 overflow-hidden">
        <img
          src={images[index]}
          alt=""
          className="max-w-full max-h-full object-contain select-none shadow-2xl animate-in zoom-in-95 duration-300"
          onClick={(e) => e.stopPropagation()}
        />
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-2 z-[110]">
        {images.map((_, i) => (
          <div 
            key={i} 
            className={`w-2 h-2 rounded-full transition-all ${i === index ? "bg-white scale-125" : "bg-white/20"}`}
          />
        ))}
      </div>
    </div>
  );
};

export default ProductImageModal;
