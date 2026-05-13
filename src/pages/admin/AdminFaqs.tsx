import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useInvalidateFaqs } from "@/hooks/useFaqs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Trash2, Plus, Pencil, ArrowUp, ArrowDown, Check, X } from "lucide-react";
import { toast } from "sonner";

const AdminFaqs = () => {
  const [faqs, setFaqs] = useState<any[] | null>(null);
  const [draft, setDraft] = useState({ question: "", answer: "" });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ question: "", answer: "" });
  const invalidate = useInvalidateFaqs();

  const load = async () => {
    const { data } = await supabase.from("faq").select("*").order("display_order");
    setFaqs(data ?? []);
    invalidate();
  };
  useEffect(() => { load(); }, []);

  const add = async () => {
    if (!draft.question || !draft.answer) return;
    const { error } = await supabase.from("faq").insert({ ...draft, display_order: (faqs?.length ?? 0) + 1 });
    if (error) toast.error(error.message); else { setDraft({ question: "", answer: "" }); load(); }
  };
  const del = async (id: string) => { await supabase.from("faq").delete().eq("id", id); load(); };

  const startEdit = (f: any) => { setEditingId(f.id); setEdit({ question: f.question, answer: f.answer }); };
  const cancelEdit = () => { setEditingId(null); setEdit({ question: "", answer: "" }); };
  const saveEdit = async () => {
    if (!editingId) return;
    const { error } = await supabase.from("faq").update({ question: edit.question, answer: edit.answer }).eq("id", editingId);
    if (error) return toast.error(error.message);
    cancelEdit(); load();
  };
  const toggleActive = async (f: any) => {
    const { error } = await supabase.from("faq").update({ active: !f.active }).eq("id", f.id);
    if (error) return toast.error(error.message);
    load();
  };
  const move = async (i: number, dir: -1 | 1) => {
    if (!faqs) return;
    const j = i + dir;
    if (j < 0 || j >= faqs.length) return;
    const a = faqs[i], b = faqs[j];
    await supabase.from("faq").update({ display_order: b.display_order }).eq("id", a.id);
    await supabase.from("faq").update({ display_order: a.display_order }).eq("id", b.id);
    load();
  };

  return (
    <div>
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight mb-6">FAQs</h1>
      <div className="bg-card rounded-2xl shadow-soft p-5 mb-4 space-y-3">
        <Input placeholder="Question" value={draft.question} onChange={e => setDraft({...draft, question: e.target.value})} />
        <Textarea placeholder="Answer" value={draft.answer} onChange={e => setDraft({...draft, answer: e.target.value})} />
        <Button variant="hero" onClick={add}><Plus className="w-4 h-4" /> Add FAQ</Button>
      </div>

      {faqs === null ? <Skeleton className="h-40 rounded-2xl" /> : (
        <div className="space-y-2">
          {faqs.map((f, i) => (
            <div key={f.id} className="bg-card rounded-2xl shadow-soft p-4">
              {editingId === f.id ? (
                <div className="space-y-2">
                  <Input value={edit.question} onChange={e => setEdit({ ...edit, question: e.target.value })} />
                  <Textarea value={edit.answer} onChange={e => setEdit({ ...edit, answer: e.target.value })} />
                  <div className="flex gap-2 justify-end">
                    <Button size="sm" variant="ghost" onClick={cancelEdit}><X className="w-4 h-4" /> Cancel</Button>
                    <Button size="sm" variant="hero" onClick={saveEdit}><Check className="w-4 h-4" /> Save</Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-brown">{f.question}</div>
                      {!f.active && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">Hidden</span>}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">{f.answer}</div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => move(i, 1)} disabled={i === faqs.length - 1}><ArrowDown className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => startEdit(f)}><Pencil className="w-4 h-4" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => del(f.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>Active</span>
                      <Switch checked={f.active} onCheckedChange={() => toggleActive(f)} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminFaqs;
