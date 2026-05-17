import { type Product } from "@/context/CartContext";
import { Skeleton } from "@/components/ui/skeleton";
import { useProducts } from "@/hooks/useProducts";
import { useSiteSection } from "@/hooks/useSiteContent";
import UnifiedProductCard from "@/components/site/UnifiedProductCard";

const Products = () => {
  const { data: rows, isLoading } = useProducts({ onlyActive: true });
  const section = useSiteSection("products_section", { eyebrow: "Today's collection", headline: "Today's Fresh Lay.", subhead: "Hand-picked this morning, packed with care, on its way to your door." });
  const items: Product[] | null = isLoading ? null : (rows ?? []).map(p => ({
    id: p.id!,
    name: p.name,
    slug: p.slug,
    benefit: p.benefit ?? "",
    description: p.description ?? null,
    unit: p.unit ?? "",
    price: Number(p.original_price),
    discountPrice: Number(p.discounted_price),
    stock_quantity: Number(p.stock_quantity),
    image: p.image_url || "",
    images: p.images || [],
  }));

  return (
    <section id="products" className="relative py-24 lg:py-36">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
      <div className="container">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-12 lg:mb-16">
          <div className="max-w-xl">
            <div className="eyebrow mb-4">{section.eyebrow}</div>
            <h2 className="display-2 text-brown">{section.headline}</h2>
            <p className="lead mt-4">{section.subhead}</p>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            Delivered in 24 hours
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {items === null && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card rounded-3xl overflow-hidden shadow-soft">
              <Skeleton className="aspect-square w-full" />
              <div className="p-6 space-y-3">
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-11 w-full mt-4" />
              </div>
            </div>
          ))}

          {items?.map((p, idx) => (
            <UnifiedProductCard key={p.id} product={p} index={idx} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default Products;
