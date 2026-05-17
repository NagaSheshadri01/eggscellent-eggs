import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus } from "lucide-react";
import { toast } from "sonner";
import ImageUploader from "@/components/admin/ImageUploader";
import { useSiteContent, useUpdateSiteSection } from "@/hooks/useSiteContent";

type Section = { key: string; title: string; description?: string; fields: { name: string; label: string; type?: "text" | "textarea" | "switch" | "image" | "links" | "color" }[] };

const SECTIONS: Section[] = [
  { key: "announcement", title: "Announcement banner", description: "Top-of-page strip. Toggle off to hide.", fields: [
    { name: "enabled", label: "Show banner", type: "switch" },
    { name: "text", label: "Banner text" },
    { name: "link", label: "Link URL (optional)" },
    { name: "bg_color", label: "Background color", type: "color" },
    { name: "text_color", label: "Text color", type: "color" },
  ]},
  { key: "hero", title: "Hero section", fields: [
    { name: "eyebrow", label: "Eyebrow / pill text" },
    { name: "headline_top", label: "Headline line 1" },
    { name: "headline_accent", label: "Italic accent word" },
    { name: "headline_end", label: "Headline ending word" },
    { name: "subhead", label: "Subhead", type: "textarea" },
    { name: "cta_label", label: "CTA button text" },
    { name: "delivery_note", label: "Delivery note" },
    { name: "image_url", label: "Hero image", type: "image" },
  ]},
  { key: "products_section", title: "Products section", fields: [
    { name: "eyebrow", label: "Eyebrow" },
    { name: "headline", label: "Headline" },
    { name: "subhead", label: "Subhead", type: "textarea" },
  ]},
  { key: "faq_section", title: "FAQ section", fields: [
    { name: "eyebrow", label: "Eyebrow" },
    { name: "headline_left", label: "Headline (plain)" },
    { name: "headline_right", label: "Headline (italic accent)" },
  ]},
  { key: "cta_footer", title: "Bottom CTA", fields: [
    { name: "eyebrow", label: "Eyebrow" },
    { name: "headline", label: "Headline" },
    { name: "subhead", label: "Subhead", type: "textarea" },
    { name: "cta_label", label: "CTA button text" },
  ]},
  { key: "footer", title: "Footer", description: "The year is automatically managed.", fields: [
    { name: "copyright", label: "Copyright text (after the year)" },
    { name: "show_support", label: "Show Support Info (Phone/Email/WhatsApp)", type: "switch" },
    { name: "links", label: "Links", type: "links" },
  ]},
];

const SectionEditor = ({ section, initial }: { section: Section; initial: any }) => {
  const [v, setV] = useState<any>(initial ?? {});
  useEffect(() => { setV(initial ?? {}); }, [initial]);
  const update = useUpdateSiteSection();

  const setField = (k: string, val: any) => setV((prev: any) => ({ ...prev, [k]: val }));

  const save = async () => {
    try { await update.mutateAsync({ key: section.key, value: v }); toast.success(`${section.title} saved`); }
    catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="bg-card rounded-2xl shadow-soft p-5 space-y-4">
      <div>
        <h2 className="font-display font-bold text-brown text-xl">{section.title}</h2>
        {section.description && <p className="text-sm text-muted-foreground mt-1">{section.description}</p>}
      </div>
      <div className="space-y-3">
        {section.fields.map(f => {
          const val = v[f.name];
          if (f.type === "switch") {
            return (
              <div key={f.name} className="flex items-center justify-between">
                <Label>{f.label}</Label>
                <Switch checked={!!val} onCheckedChange={(b) => setField(f.name, b)} />
              </div>
            );
          }
          if (f.type === "textarea") {
            return <div key={f.name}><Label>{f.label}</Label><Textarea value={val ?? ""} onChange={e => setField(f.name, e.target.value)} /></div>;
          }
          if (f.type === "color") {
            return (
              <div key={f.name} className="flex items-center justify-between gap-4">
                <Label>{f.label}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground">{val || "#000000"}</span>
                  <Input type="color" className="w-12 h-8 p-0 border-none bg-transparent cursor-pointer" value={val ?? "#000000"} onChange={e => setField(f.name, e.target.value)} />
                </div>
              </div>
            );
          }
          if (f.type === "image") {
            return (
              <div key={f.name}>
                <Label>{f.label}</Label>
                <ImageUploader value={val} onChange={(url) => setField(f.name, url ?? "")} bucket="site-images" pathPrefix={section.key} />
              </div>
            );
          }
          if (f.type === "links") {
            const links: { label: string; href: string }[] = Array.isArray(val) ? val : [];
            return (
              <div key={f.name} className="space-y-2">
                <Label>{f.label}</Label>
                {links.map((l, i) => (
                  <div key={i} className="flex gap-2">
                    <Input placeholder="Label" value={l.label} onChange={e => { const n = [...links]; n[i] = { ...n[i], label: e.target.value }; setField(f.name, n); }} />
                    <Input placeholder="URL" value={l.href} onChange={e => { const n = [...links]; n[i] = { ...n[i], href: e.target.value }; setField(f.name, n); }} />
                    <Button size="sm" variant="ghost" onClick={() => setField(f.name, links.filter((_, j) => j !== i))}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                ))}
                <Button size="sm" variant="ghost" onClick={() => setField(f.name, [...links, { label: "", href: "" }])}><Plus className="w-4 h-4" /> Add link</Button>
              </div>
            );
          }
          return <div key={f.name}><Label>{f.label}</Label><Input value={val ?? ""} onChange={e => setField(f.name, e.target.value)} /></div>;
        })}
      </div>
      <Button variant="hero" onClick={save} disabled={update.isPending}>
        {update.isPending ? "Saving..." : "Save changes"}
      </Button>
    </div>
  );
};

const AdminContent = () => {
  const { data, isLoading, isError } = useSiteContent();
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Site content</h1>
      <p className="text-sm text-muted-foreground -mt-3">Edit copy and imagery shown on the live site. Changes appear instantly after save.</p>
      {isLoading ? <Skeleton className="h-80 rounded-2xl" /> : isError ? (
        <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-100">
          <h2 className="text-amber-700 font-bold">System Setup Needed</h2>
          <p className="text-amber-600 text-sm mt-1">The cms_content table was not found. Please run the provided SQL migration to initialize the system.</p>
          <div className="mt-4 flex gap-3 justify-center">
            <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => window.location.reload()}>Retry Sync</Button>
            <a href="https://supabase.com/dashboard/project/_/editor" target="_blank" rel="noreferrer">
              <Button variant="hero" className="bg-amber-600 hover:bg-amber-700">Go to SQL Editor</Button>
            </a>
          </div>
        </div>
      ) : SECTIONS.map(s => (
        <SectionEditor key={s.key} section={s} initial={data?.[s.key] ?? {}} />
      ))}
    </div>
  );
};

export default AdminContent;