import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import ImageUploader from "@/components/admin/ImageUploader";
import { AdminProduct, useProducts, useProductMutations } from "@/hooks/useProducts";

const empty: AdminProduct = {
  name: "", slug: "", benefit: "", unit: "", original_price: 0, discounted_price: 0,
  stock_quantity: 0, image_url: "", images: [], description: "", active: true, display_order: 0,
};

const AdminProducts = () => {
  const { data: products, isLoading } = useProducts();
  const { upsert, remove, swapOrder } = useProductMutations();
  const [editing, setEditing] = useState<AdminProduct | null>(null);
  const [open, setOpen] = useState(false);

  const save = async () => {
    if (!editing) return;
    if (!editing.name || !editing.slug) return toast.error("Name and slug are required");
    try {
      await upsert.mutateAsync({
        ...editing,
        display_order: editing.display_order || ((products?.length ?? 0) + 1),
      });
      toast.success("Saved");
      setOpen(false);
      setEditing(null);
    } catch (e: any) { toast.error(e.message); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this product?")) return;
    try { await remove.mutateAsync(id); toast.success("Deleted"); } catch (e: any) { toast.error(e.message); }
  };

  const toggleStock = async (p: AdminProduct) => {
    try { await upsert.mutateAsync({ ...p, stock_quantity: p.stock_quantity > 0 ? 0 : 100 }); }
    catch (e: any) { toast.error(e.message); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    if (!products) return;
    const j = i + dir;
    if (j < 0 || j >= products.length) return;
    try { await swapOrder.mutateAsync({ a: products[i], b: products[j] }); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Products</h1>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button variant="hero" onClick={() => { setEditing({ ...empty }); setOpen(true); }}>
              <Plus className="w-4 h-4" /> New product
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? "Edit product" : "New product"}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
                <div><Label>Name</Label><Input value={editing.name} onChange={e => setEditing({...editing, name: e.target.value})} /></div>
                <div><Label>Slug</Label><Input value={editing.slug} onChange={e => setEditing({...editing, slug: e.target.value})} /></div>
                <div>
                  <Label>Product Gallery</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {(editing.images || []).map((url, idx) => (
                      <div key={idx} className="relative group rounded-xl overflow-hidden border border-border aspect-square bg-secondary/20">
                        <img src={url} alt="" className="w-full h-full object-cover" />
                        <button 
                          onClick={() => setEditing({ ...editing, images: editing.images.filter((_, i) => i !== idx) })}
                          className="absolute top-2 right-2 p-1.5 bg-destructive text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                    <div className="aspect-square">
                      <ImageUploader
                        value={null}
                        onChange={(url) => {
                          if (url) setEditing({ ...editing, images: [...(editing.images || []), url] });
                        }}
                        bucket="product-images"
                        pathPrefix={editing.slug || "products"}
                        className="h-full"
                      />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label>Unit</Label><Input value={editing.unit ?? ""} onChange={e => setEditing({...editing, unit: e.target.value})} /></div>
                  <div><Label>Stock</Label><Input type="number" value={editing.stock_quantity} onChange={e => setEditing({...editing, stock_quantity: +e.target.value})} /></div>
                  <div><Label>Compare price ₹</Label><Input type="number" value={editing.original_price} onChange={e => setEditing({...editing, original_price: +e.target.value})} /></div>
                  <div><Label>Price ₹</Label><Input type="number" value={editing.discounted_price} onChange={e => setEditing({...editing, discounted_price: +e.target.value})} /></div>
                </div>
                <div><Label>Benefit tagline</Label><Input value={editing.benefit ?? ""} onChange={e => setEditing({...editing, benefit: e.target.value})} /></div>
                <div><Label>Description</Label><Textarea value={editing.description ?? ""} onChange={e => setEditing({...editing, description: e.target.value})} /></div>
                <div className="flex items-center gap-2"><Switch checked={editing.active} onCheckedChange={(v) => setEditing({...editing, active: v})} /> <Label>Active</Label></div>
                <Button variant="hero" className="w-full" onClick={save} disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving..." : "Save"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {isLoading && <Skeleton className="h-80 rounded-2xl" />}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products?.map((p, i) => (
          <div key={p.id} className="bg-card rounded-2xl shadow-soft p-4">
            <div className="flex gap-3">
              {p.images?.length > 0 || p.image_url
                ? <img src={p.images?.[0] || p.image_url!} className="w-16 h-16 rounded-lg object-cover" alt={p.name} />
                : <div className="w-16 h-16 rounded-lg bg-secondary grid place-items-center text-xs text-muted-foreground">No image</div>}
              <div className="flex-1 min-w-0">
                <div className="font-display font-semibold text-brown truncate">{p.name}</div>
                <div className="text-xs text-muted-foreground">{p.unit} · Stock {p.stock_quantity}</div>
                <div className="font-display font-bold text-brown mt-1 flex items-baseline gap-1.5">
                  <span className="text-xs text-muted-foreground line-through font-normal">₹{p.original_price}</span>
                  ₹{p.discounted_price}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between gap-1 mt-3">
              <button onClick={() => toggleStock(p)} className={`text-[11px] font-bold uppercase px-2 py-1 rounded-md ${p.stock_quantity > 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                {p.stock_quantity > 0 ? "In stock" : "Out of stock"}
              </button>
              <div className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === (products.length - 1)}><ArrowDown className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="w-4 h-4" /></Button>
                <Button size="sm" variant="ghost" onClick={() => del(p.id!)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
              </div>
            </div>
            {!p.active && <div className="mt-2 text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-secondary text-muted-foreground inline-block">Hidden</div>}
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminProducts;