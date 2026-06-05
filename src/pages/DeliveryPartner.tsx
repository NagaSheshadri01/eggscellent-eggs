import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Bike, CheckCircle2 } from "lucide-react";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const DeliveryPartner = () => {
  const { user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    full_name: "", phone: "", email: user?.email || "", vehicle_type: "Bike",
    city: "", pincode: "", availability: "", experience_years: "" as any,
  });

  const submit = async () => {
    if (!form.full_name || !form.phone) return toast.error("Name and phone are required");
    setBusy(true);
    const { error } = await (supabase as any).from("delivery_partners").insert({
      ...form,
      user_id: user?.id ?? null,
      experience_years: form.experience_years ? Number(form.experience_years) : null,
      availability: { note: form.availability },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    setSubmitted(true);
  };

  if (submitted) return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container max-w-md py-16 text-center">
        <CheckCircle2 className="w-16 h-16 text-success mx-auto mb-4" />
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Application received</h1>
        <p className="text-muted-foreground mt-2">Our team will review your details and get back within 48 hours.</p>
      </main>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Seo title="Become a delivery partner — Eggscellent" description="Earn flexible income delivering fresh eggs in your neighbourhood." />
      <Header />
      <main className="container max-w-2xl py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-full gradient-yolk grid place-items-center mx-auto mb-3"><Bike className="w-6 h-6 text-brown" /></div>
          <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Become a delivery partner</h1>
          <p className="text-muted-foreground mt-2">Flexible hours · Weekly payouts · Premium customers</p>
        </div>

        <div className="bg-card rounded-3xl shadow-soft p-6 space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div><Label>Full name *</Label><Input value={form.full_name} onChange={e => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><Label>Phone *</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Email (optional)</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Vehicle type</Label>
              <Select value={form.vehicle_type} onValueChange={(v) => setForm({ ...form, vehicle_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["Bike","Scooter","Bicycle","Car"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Years of experience</Label><Input type="number" value={form.experience_years} onChange={e => setForm({ ...form, experience_years: e.target.value })} /></div>
            <div><Label>City</Label><Input value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
            <div><Label>Area / Pincode</Label><Input value={form.pincode} onChange={e => setForm({ ...form, pincode: e.target.value })} /></div>
            <div className="sm:col-span-2"><Label>Availability timings</Label><Textarea rows={2} placeholder="e.g. Weekdays 7AM–11AM, weekends all day" value={form.availability} onChange={e => setForm({ ...form, availability: e.target.value })} /></div>
          </div>
          <p className="text-xs text-muted-foreground">Aadhaar &amp; driving license verification will be requested after we contact you.</p>
          <Button variant="hero" size="lg" className="w-full" onClick={submit} disabled={busy}>{busy ? "Submitting…" : "Submit application"}</Button>
        </div>
      </main>
    </div>
  );
};

export default DeliveryPartner;