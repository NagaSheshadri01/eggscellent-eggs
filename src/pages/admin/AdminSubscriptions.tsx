import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Save, X, Sparkles } from "lucide-react";
import { useProducts } from "@/hooks/useProducts";

type Plan = {
  id?: string;
  title: string;
  description?: string | null;
  product_id: string | null;
  frequency: "daily" | "alternate" | "weekly";
  default_quantity: number;
  discount_type: "percent" | "amount";
  discount_value: number;
  active: boolean;
  popular: boolean;
  display_order: number;
};

const emptyPlan: Plan = {
  title: "",
  description: "",
  product_id: null,
  frequency: "daily",
  default_quantity: 1,
  discount_type: "percent",
  discount_value: 15,
  active: true,
  popular: false,
  display_order: 0,
};

const PlanForm = ({
  value, onChange, onSave, onCancel, products, busy,
}: {
  value: Plan;
  onChange: (p: Plan) => void;
  onSave: () => void;
  onCancel: () => void;
  products: { id: string; name: string }[];
  busy: boolean;
}) => (
  <div className="grid sm:grid-cols-2 gap-3">
    <div className="sm:col-span-2"><Label>Title</Label>
      <Input value={value.title} onChange={e => onChange({ ...value, title: e.target.value })} placeholder="Daily Saver" />
    </div>
    <div><Label>Product</Label>
      <Select value={value.product_id ?? "any"} onValueChange={v => onChange({ ...value, product_id: v === "any" ? null : v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="any">Any product</SelectItem>
          {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
    <div><Label>Frequency</Label>
      <Select value={value.frequency} onValueChange={(v: any) => onChange({ ...value, frequency: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="daily">Daily</SelectItem>
          <SelectItem value="alternate">Alternate days</SelectItem>
          <SelectItem value="weekly">Weekly</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div><Label>Default quantity</Label>
      <Input type="number" min={1} value={value.default_quantity}
        onChange={e => onChange({ ...value, default_quantity: Number(e.target.value || 1) })} />
    </div>
    <div><Label>Discount type</Label>
      <Select value={value.discount_type} onValueChange={(v: any) => onChange({ ...value, discount_type: v })}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="percent">Percent (%)</SelectItem>
          <SelectItem value="amount">Flat amount (₹)</SelectItem>
        </SelectContent>
      </Select>
    </div>
    <div><Label>Discount value</Label>
      <Input type="number" min={0} value={value.discount_value}
        onChange={e => onChange({ ...value, discount_value: Number(e.target.value || 0) })} />
    </div>
    <div className="sm:col-span-2"><Label>Description (optional)</Label>
      <Input value={value.description ?? ""} onChange={e => onChange({ ...value, description: e.target.value })} />
    </div>
    <div className="flex items-center gap-2">
      <Switch checked={value.active} onCheckedChange={v => onChange({ ...value, active: v })} />
      <Label>Active</Label>
    </div>
    <div className="flex items-center gap-2">
      <Switch checked={value.popular} onCheckedChange={v => onChange({ ...value, popular: v })} />
      <Label>Mark as popular</Label>
    </div>
    <div className="sm:col-span-2 flex gap-2 justify-end pt-2">
      <Button variant="ghost" onClick={onCancel}><X className="w-4 h-4" /> Cancel</Button>
      <Button variant="hero" onClick={onSave} disabled={busy}>
        <Save className="w-4 h-4" /> Save plan
      </Button>
    </div>
  </div>
);

const AdminSubscriptions = () => {
  const qc = useQueryClient();
  const { data: products = [] } = useProducts({ onlyActive: false });
  const productOptions = (products ?? []).map(p => ({ id: p.id!, name: p.name }));

  const plansQ = useQuery({
    queryKey: ["admin_subscription_plans"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subscription_plans")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Plan[];
    },
  });

  const [editing, setEditing] = useState<Plan | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Plan>(emptyPlan);

  const save = useMutation({
    mutationFn: async (p: Plan) => {
      const payload = { ...p, discount_value: Number(p.discount_value) };
      if (p.id) {
        const { error } = await supabase.from("subscription_plans").update(payload).eq("id", p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subscription_plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Plan saved");
      setEditing(null); setCreating(false); setDraft(emptyPlan);
      qc.invalidateQueries({ queryKey: ["admin_subscription_plans"] });
      qc.invalidateQueries({ queryKey: ["subscription_plans"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subscription_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plan deleted");
      qc.invalidateQueries({ queryKey: ["admin_subscription_plans"] });
      qc.invalidateQueries({ queryKey: ["subscription_plans"] });
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const productNameById = (id: string | null) => id ? productOptions.find(p => p.id === id)?.name ?? "—" : "Any product";

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Subscription plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Plans configured here power the Subscribe & Save toggle on every product card.</p>
        </div>
        {!creating && !editing && (
          <Button variant="hero" onClick={() => { setDraft(emptyPlan); setCreating(true); }}>
            <Plus className="w-4 h-4" /> New plan
          </Button>
        )}
      </div>

      {(creating || editing) && (
        <div className="bg-card rounded-2xl shadow-soft p-5 sm:p-6">
          <h2 className="font-display font-bold text-brown text-lg mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" /> {editing ? "Edit plan" : "Create plan"}
          </h2>
          <PlanForm
            value={editing ?? draft}
            onChange={(p) => editing ? setEditing(p) : setDraft(p)}
            onSave={() => save.mutate(editing ?? draft)}
            onCancel={() => { setEditing(null); setCreating(false); setDraft(emptyPlan); }}
            products={productOptions}
            busy={save.isPending}
          />
        </div>
      )}

      <div className="bg-card rounded-2xl shadow-soft p-5 sm:p-6">
        <h2 className="font-display font-bold text-brown text-lg mb-3">All plans</h2>
        {plansQ.isLoading && <Skeleton className="h-32 rounded-xl" />}
        {plansQ.data && plansQ.data.length === 0 && (
          <p className="text-sm text-muted-foreground py-6 text-center">No plans yet — create one to enable subscriptions.</p>
        )}
        <div className="space-y-2">
          {(plansQ.data ?? []).map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-brown truncate flex items-center gap-2">
                  {p.title}
                  {p.popular && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-primary/20 text-brown">Popular</span>}
                  {!p.active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-muted text-muted-foreground">Inactive</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {productNameById(p.product_id)} · {p.frequency} · qty {p.default_quantity} · {p.discount_value}
                  {p.discount_type === "percent" ? "% off" : "₹ off"}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => { setEditing(p); setCreating(false); }}>
                <Pencil className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete "${p.title}"?`)) del.mutate(p.id!); }}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminSubscriptions;
