import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";

const AdminCoupons = () => {
  const [list, setList] = useState<any[] | null>(null);
  const [draft, setDraft] = useState({ code: "", discount_type: "percent", discount_value: 10, min_order_amount: 0, usage_limit: 500 });
  const load = () => supabase.from("coupons").select("*").order("created_at", { ascending: false }).then(({data}) => setList(data ?? []));
  useEffect(() => { load(); }, []);
  const add = async () => {
    if (!draft.code) return;
    const { error } = await supabase.from("coupons").insert({ ...draft, code: draft.code.toUpperCase(), discount_type: draft.discount_type as any, active: true, usage_limit: draft.usage_limit } as any);
    if (error) toast.error(error.message); else { setDraft({ code: "", discount_type: "percent", discount_value: 10, min_order_amount: 0, usage_limit: 500 }); load(); }
  };
  const del = async (id: string) => { await supabase.from("coupons").delete().eq("id", id); load(); };
  return (
    <div>
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">Coupons</h1>
      <div className="bg-card rounded-2xl shadow-soft p-5 mb-4 space-y-3">
        <div className="grid sm:grid-cols-4 gap-2">
          <Input placeholder="CODE" value={draft.code} onChange={e => setDraft({...draft, code: e.target.value.toUpperCase()})} />
          <Select value={draft.discount_type} onValueChange={(v) => setDraft({...draft, discount_type: v})}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="percent">Percent</SelectItem>
              <SelectItem value="flat">Flat ₹</SelectItem>
            </SelectContent>
          </Select>
          <div>
            <Input type="number" placeholder="Value" value={draft.discount_value} onChange={e => setDraft({...draft, discount_value: +e.target.value})} />
            <p className="text-[10px] text-muted-foreground mt-1">Amount in ₹ or % to deduct.</p>
          </div>
          <div>
            <Input type="number" placeholder="Min order" value={draft.min_order_amount} onChange={e => setDraft({...draft, min_order_amount: +e.target.value})} />
            <p className="text-[10px] text-muted-foreground mt-1">Min order value required.</p>
          </div>
          <div>
            <Input type="number" placeholder="Usage Limit" value={draft.usage_limit} onChange={e => setDraft({...draft, usage_limit: +e.target.value})} />
            <p className="text-[10px] text-muted-foreground mt-1">Total global uses.</p>
          </div>
        </div>
        <Button variant="hero" onClick={add}><Plus className="w-4 h-4" /> Create coupon</Button>
      </div>
      {list === null ? <Skeleton className="h-40 rounded-2xl" /> : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {list.map(c => (
            <div key={c.id} className="bg-card rounded-2xl shadow-soft p-4 flex justify-between gap-3">
              <div>
                <div className="font-mono font-bold text-brown">{c.code}</div>
                <div className="text-sm text-muted-foreground">{c.discount_type === "percent" ? `${c.discount_value}% off` : `₹${c.discount_value} off`}{c.min_order_amount ? ` · min ₹${c.min_order_amount}` : ""}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
export default AdminCoupons;
