import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2, Tag, Truck, Gift, Package } from "lucide-react";
import type { OfferType } from "@/hooks/useOffers";

const OFFER_TYPES: { value: OfferType; label: string; icon: any; desc: string }[] = [
  { value: "product_discount", icon: Tag, label: "Cash Discount", desc: "Apply a coupon code for a cash/percent off" },
  { value: "free_delivery", icon: Truck, label: "Free Delivery", desc: "Waive delivery fee above a cart threshold" },
  { value: "product_free", icon: Gift, label: "Free Product", desc: "Give a specific product free above threshold" },
  { value: "bundle_buy", icon: Package, label: "Bundle Deal", desc: "Discount when specific products are all in cart" },
];

const empty = { title: "", description: "", offer_type: "product_discount" as OfferType, min_order_value: 0, coupon_code_to_apply: "", reward_product_slug: "", required_product_slugs: "" };

const AdminOffers = () => {
  const [list, setList] = useState<any[] | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [draft, setDraft] = useState({ ...empty });

  const load = () => (supabase as any).from("offers").select("*").order("created_at", { ascending: false }).then(({ data }: any) => setList(data ?? []));
  const loadProducts = () => (supabase as any).from("products").select("name, slug").eq("active", true).order("name").then(({ data }: any) => setProducts(data ?? []));

  useEffect(() => { load(); loadProducts(); }, []);

  const add = async () => {
    if (!draft.title || !draft.offer_type) return toast.error("Title and offer type are required");
    if (draft.offer_type === "product_discount" && !draft.coupon_code_to_apply) {
      return toast.error("Please enter a coupon code for this offer type");
    }
    const payload: any = {
      title: draft.title,
      description: draft.description,
      offer_type: draft.offer_type,
      min_order_value: draft.min_order_value,
      is_active: true,
    };
    if (draft.offer_type === "product_discount") payload.coupon_code_to_apply = draft.coupon_code_to_apply.toUpperCase();
    if (draft.offer_type === "product_free") payload.reward_product_slug = draft.reward_product_slug;
    if (draft.offer_type === "bundle_buy") {
      payload.required_product_slugs = draft.required_product_slugs.split(",").map((s: string) => s.trim()).filter(Boolean);
    }

    const { error } = await (supabase as any).from("offers").insert(payload);
    if (error) toast.error(error.message);
    else { setDraft({ ...empty }); load(); toast.success("Offer created"); }
  };

  const del = async (id: string) => {
    if (!confirm("Delete this offer?")) return;
    const { error } = await (supabase as any).from("offers").delete().eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const toggle = async (id: string, current: boolean) => {
    const { error } = await (supabase as any).from("offers").update({ is_active: !current }).eq("id", id);
    if (error) toast.error(error.message); else load();
  };

  const selectedType = OFFER_TYPES.find(t => t.value === draft.offer_type);

  return (
    <div>
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-2">Visual Offers</h1>
      <p className="text-sm text-muted-foreground mb-8">Build rule-based reward cards shown in the cart. Each type has its own logic engine.</p>

      {/* ── Creator Card ── */}
      <div className="bg-card rounded-2xl shadow-soft p-5 mb-8 border border-border/60 space-y-4">
        <h2 className="font-display font-semibold text-brown flex items-center gap-2"><Plus className="w-4 h-4 text-primary" /> Create Offer</h2>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Offer Title *</label>
            <Input placeholder="e.g. Weekend Bundle Deal" value={draft.title} onChange={e => setDraft({ ...draft, title: e.target.value })} />
          </div>
          <div>
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Offer Type *</label>
            <Select value={draft.offer_type} onValueChange={v => setDraft({ ...draft, offer_type: v as OfferType })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {OFFER_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>
                    <span className="flex items-center gap-2"><t.icon className="w-4 h-4" /> {t.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedType && <p className="text-[10px] text-muted-foreground mt-1">{selectedType.desc}</p>}
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Description</label>
            <Textarea placeholder="Describe what the customer needs to do..." value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} />
          </div>

          {/* Conditional: Min Order Value (hidden for bundle_buy) */}
          {draft.offer_type !== "bundle_buy" && (
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Min Order Value (₹)</label>
              <Input type="number" value={draft.min_order_value} onChange={e => setDraft({ ...draft, min_order_value: +e.target.value })} />
            </div>
          )}

          {/* Conditional: Coupon Code (product_discount only) */}
          {draft.offer_type === "product_discount" && (
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Target Coupon Code *</label>
              <Input placeholder="e.g. WELCOME50" value={draft.coupon_code_to_apply} onChange={e => setDraft({ ...draft, coupon_code_to_apply: e.target.value.toUpperCase() })} />
              <p className="text-[10px] text-muted-foreground mt-1">Must exist in your Coupons page.</p>
            </div>
          )}

          {/* Conditional: Reward product slug (product_free only) */}
          {draft.offer_type === "product_free" && (
            <div>
              <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Reward Product Slug *</label>
              <Input placeholder="e.g. eggs-6pc" value={draft.reward_product_slug} onChange={e => setDraft({ ...draft, reward_product_slug: e.target.value.toLowerCase() })} />
              <p className="text-[10px] text-muted-foreground mt-1">The product slug that is given free.</p>
            </div>
          )}

          {/* Conditional: Required slugs (bundle_buy only) */}
          {draft.offer_type === "bundle_buy" && (
            <div className="sm:col-span-2">
              <label className="text-xs font-bold uppercase text-muted-foreground mb-1 block">Required Product Slugs (comma-separated) *</label>
              <Input placeholder="e.g. white-eggs-6pc, brown-eggs-6pc" value={draft.required_product_slugs} onChange={e => setDraft({ ...draft, required_product_slugs: e.target.value })} />
              <p className="text-[10px] text-muted-foreground mt-1">All products must be present in the cart to unlock this deal.</p>
            </div>
          )}
        </div>

        {/* Slug Quick Reference Section */}
        <div className="pt-4 border-t border-border/40">
          <label className="text-[10px] font-bold uppercase text-primary mb-2 block flex items-center gap-1.5">
            <Package className="w-3 h-3" /> Slug Quick Reference
          </label>
          <div className="max-h-32 overflow-y-auto bg-secondary/30 rounded-xl p-3 border border-border/40 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
            {products.map(p => (
              <div key={p.slug} className="flex flex-col">
                <span className="text-[9px] font-bold text-brown truncate">{p.name}</span>
                <code className="text-[10px] text-primary font-mono select-all bg-white/50 px-1 rounded border border-primary/10 w-fit">{p.slug}</code>
              </div>
            ))}
            {products.length === 0 && <p className="col-span-3 text-[10px] text-muted-foreground text-center py-2">No active products found.</p>}
          </div>
          <p className="text-[9px] text-muted-foreground mt-2 italic">Tip: Click a slug to select it, then copy (Ctrl+C) and paste into the fields above.</p>
        </div>

        <Button variant="hero" onClick={add}>Create Offer</Button>
      </div>

      {/* ── Offer List ── */}
      {list === null ? (
        <div className="grid sm:grid-cols-2 gap-4"><Skeleton className="h-32 rounded-2xl" /><Skeleton className="h-32 rounded-2xl" /></div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {list.map(o => {
            const TypeMeta = OFFER_TYPES.find(t => t.value === o.offer_type);
            const Icon = TypeMeta?.icon || Tag;
            return (
              <div key={o.id} className={`bg-card rounded-2xl shadow-soft p-5 border flex flex-col justify-between group transition-all ${o.is_active ? "border-border/40" : "opacity-50 border-dashed"}`}>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-display font-bold text-brown">{o.title}</div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-bold uppercase">
                      <Icon className="w-3 h-3" /> {TypeMeta?.label || o.offer_type}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{o.description}</p>
                  {o.coupon_code_to_apply && <div className="text-[10px] font-mono text-brown font-bold">Code: {o.coupon_code_to_apply}</div>}
                  {o.min_order_value > 0 && <div className="text-[10px] text-muted-foreground">Min order: ₹{o.min_order_value}</div>}
                  {o.required_product_slugs?.length > 0 && <div className="text-[10px] text-muted-foreground mt-1">Requires: {o.required_product_slugs.join(", ")}</div>}
                </div>
                <div className="mt-4 pt-4 border-t border-border/40 flex justify-between items-center">
                  <button onClick={() => toggle(o.id, o.is_active)} className={`text-[10px] font-bold px-3 py-1 rounded-full transition-colors ${o.is_active ? "bg-success/10 text-success" : "bg-secondary text-muted-foreground"}`}>
                    {o.is_active ? "Active" : "Inactive"}
                  </button>
                  <Button size="sm" variant="ghost" onClick={() => del(o.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>
            );
          })}
          {list.length === 0 && (
            <div className="sm:col-span-3 text-center py-12 bg-secondary/20 rounded-3xl border border-dashed border-border">
              <p className="text-muted-foreground">No offers created yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminOffers;
