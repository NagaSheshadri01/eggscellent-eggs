import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, MapPin, Truck, Building2, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useAppSettings, useUpdateAppSetting } from "@/hooks/useAppSettings";
import { usePincodes, useUpsertPincode, useDeletePincode } from "@/hooks/useServiceablePincodes";


const Section = ({ icon: Icon, title, children }: any) => (
  <div className="bg-card rounded-2xl shadow-soft p-5 sm:p-6 space-y-4">
    <h2 className="font-display font-bold text-brown text-xl flex items-center gap-2"><Icon className="w-5 h-5 text-primary" /> {title}</h2>
    {children}
  </div>
);

const AdminSettings = () => {
  const { data, isLoading } = useAppSettings();
  const update = useUpdateAppSetting();

  const [delivery, setDelivery] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);
  const [announcement, setAnnouncement] = useState<any>(null);

  useEffect(() => {
    if (data) {
      setDelivery(data.delivery);
      setBusiness(data.business);
      setAnnouncement(data.announcement);
    }
  }, [data]);

  const save = async (key: string, value: any) => {
    try { await update.mutateAsync({ key, value }); toast.success("Saved"); }
    catch (e: any) { toast.error(e.message); }
  };

  const pincodes = usePincodes();
  const upsertPin = useUpsertPincode();
  const delPin = useDeletePincode();
  const [newPin, setNewPin] = useState({ pincode: "", area_name: "" });

  if (isLoading || !delivery) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Operational control center. Changes apply instantly across the site.</p>
      </div>

      <Section icon={Truck} title="Delivery">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Delivery fee (₹)</Label><Input type="number" value={delivery.delivery_fee} onChange={e => setDelivery({ ...delivery, delivery_fee: Number(e.target.value) })} /></div>
          <div><Label>Free delivery above (₹)</Label><Input type="number" value={delivery.free_delivery_threshold} onChange={e => setDelivery({ ...delivery, free_delivery_threshold: Number(e.target.value) })} /></div>
          <div><Label>Minimum order amount (₹)</Label><Input type="number" value={delivery.minimum_order_amount} onChange={e => setDelivery({ ...delivery, minimum_order_amount: Number(e.target.value) })} /></div>
          <div><Label>Max delivery radius (km)</Label><Input type="number" value={delivery.max_delivery_radius_km} onChange={e => setDelivery({ ...delivery, max_delivery_radius_km: Number(e.target.value) })} /></div>
          <div><Label>Delivery start time</Label><Input type="time" value={delivery.delivery_start_time} onChange={e => setDelivery({ ...delivery, delivery_start_time: e.target.value })} /></div>
          <div><Label>Delivery end time</Label><Input type="time" value={delivery.delivery_end_time} onChange={e => setDelivery({ ...delivery, delivery_end_time: e.target.value })} /></div>
        </div>
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center gap-3"><Switch checked={delivery.delivery_enabled} onCheckedChange={(b) => setDelivery({ ...delivery, delivery_enabled: b })} /><span className="text-sm text-brown font-medium">Delivery enabled</span></div>
          <Button variant="hero" onClick={() => save("delivery", delivery)}>Save delivery</Button>
        </div>
      </Section>

      <Section icon={Building2} title="Business">
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Business name</Label><Input value={business.business_name} onChange={e => setBusiness({ ...business, business_name: e.target.value })} /></div>
          <div><Label>Support phone</Label><Input value={business.support_phone} onChange={e => setBusiness({ ...business, support_phone: e.target.value })} /></div>
          <div><Label>Support email</Label><Input value={business.support_email} onChange={e => setBusiness({ ...business, support_email: e.target.value })} /></div>
          <div><Label>WhatsApp number</Label><Input value={business.whatsapp_number} onChange={e => setBusiness({ ...business, whatsapp_number: e.target.value })} /></div>
        </div>
        <Button variant="hero" onClick={() => save("business", business)}>Save business</Button>
      </Section>

      <Section icon={Megaphone} title="Announcement banner">
        <div className="flex items-center justify-between"><Label>Show banner</Label><Switch checked={!!announcement?.enabled} onCheckedChange={(b) => setAnnouncement({ ...announcement, enabled: b })} /></div>
        <div><Label>Text</Label><Input value={announcement?.text || ""} onChange={e => setAnnouncement({ ...announcement, text: e.target.value })} /></div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div><Label>Background</Label><Input type="color" value={announcement?.background_color || "#FFE6B5"} onChange={e => setAnnouncement({ ...announcement, background_color: e.target.value })} /></div>
          <div><Label>Text color</Label><Input type="color" value={announcement?.text_color || "#5C4327"} onChange={e => setAnnouncement({ ...announcement, text_color: e.target.value })} /></div>
          <div><Label>Link (optional)</Label><Input value={announcement?.link || ""} onChange={e => setAnnouncement({ ...announcement, link: e.target.value })} /></div>
        </div>
        <Button variant="hero" onClick={() => save("announcement", announcement)}>Save banner</Button>
      </Section>

      <Section icon={MapPin} title="Serviceable pincodes">
        <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
          <Input placeholder="Pincode" value={newPin.pincode} onChange={e => setNewPin({ ...newPin, pincode: e.target.value })} />
          <Input placeholder="Area name" value={newPin.area_name} onChange={e => setNewPin({ ...newPin, area_name: e.target.value })} />
          <Button variant="brown" onClick={async () => {
            if (!/^\d{6}$/.test(newPin.pincode)) return toast.error("Enter a 6-digit pincode");
            try { await upsertPin.mutateAsync({ pincode: newPin.pincode, area_name: newPin.area_name, active: true }); setNewPin({ pincode: "", area_name: "" }); toast.success("Added"); }
            catch (e: any) { toast.error(e.message); }
          }}><Plus className="w-4 h-4" /> Add</Button>
        </div>
        <div className="space-y-2 mt-2">
          {pincodes.data?.map(p => (
            <div key={p.id} className="flex items-center gap-3 p-3 rounded-xl border border-border">
              <span className="font-mono font-semibold text-brown w-20">{p.pincode}</span>
              <Input className="flex-1 h-8" value={p.area_name || ""} onChange={(e) => upsertPin.mutate({ pincode: p.pincode, area_name: e.target.value, active: p.active })} />
              <Switch checked={p.active} onCheckedChange={(b) => upsertPin.mutate({ pincode: p.pincode, area_name: p.area_name || "", active: b })} />
              <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete pincode?")) delPin.mutate(p.id); }}><Trash2 className="w-4 h-4 text-destructive" /></Button>
            </div>
          ))}
          {pincodes.data?.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No serviceable pincodes yet.</p>}
        </div>
      </Section>
    </div>
  );
};

export default AdminSettings;