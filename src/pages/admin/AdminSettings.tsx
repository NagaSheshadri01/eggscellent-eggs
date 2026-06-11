import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, MapPin, Truck, Building2, Clock, Navigation } from "lucide-react";
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
  const { data, isLoading, isError } = useAppSettings();
  const update = useUpdateAppSetting();

  const [delivery, setDelivery] = useState<any>(null);
  const [business, setBusiness] = useState<any>(null);

  useEffect(() => {
    if (data) {
      setDelivery(data.delivery);
      setBusiness(data.business);
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

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;
  
  if (isError || (!data && !isLoading)) {
    return (
      <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-100">
        <h2 className="text-amber-700 font-bold">System Setup Needed</h2>
        <p className="text-amber-600 text-sm mt-1">The site_settings table was not found. Please run the provided SQL migration to initialize the system.</p>
        <div className="mt-4 flex gap-3 justify-center">
          <Button variant="outline" className="border-amber-200 text-amber-700 hover:bg-amber-100" onClick={() => window.location.reload()}>Retry Sync</Button>
          <a href="https://supabase.com/dashboard/project/_/editor" target="_blank" rel="noreferrer">
            <Button variant="hero" className="bg-amber-600 hover:bg-amber-700">Go to SQL Editor</Button>
          </a>
        </div>
      </div>
    );
  }

  if (!delivery) return null;

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

      <Section icon={Clock} title="Delivery Slots Management">
        <p className="text-sm text-muted-foreground mb-4">Configure operational shifts and their corresponding cutoff times.</p>
        <div className="space-y-3">
          <DeliverySlotsManager />
        </div>
      </Section>

      <Section icon={Navigation} title="Logistics & Distance Pricing">
        <p className="text-sm text-muted-foreground mb-4">Manage dynamic delivery fees calculated using real-time Haversine distance.</p>
        <DistancePricingManager />
      </Section>
    </div>
  );
};

const DeliverySlotsManager = () => {
  const { data: slots, refetch } = useQuery({
    queryKey: ["admin_delivery_slots"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("delivery_slots") as any).select("*").order("cutoff_time", { ascending: true });
      if (error) throw error;
      return data as any[];
    }
  });

  const updateSlot = async (id: string, updates: any) => {
    const { error } = await (supabase.from("delivery_slots") as any).update(updates).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Slot updated"); refetch(); }
  };

  const addSlot = async (newSlot: any) => {
    if (!newSlot.slot_key || !newSlot.label || !newSlot.cutoff_time) return toast.error("Fill all fields");
    const { error } = await (supabase.from("delivery_slots") as any).insert([newSlot]);
    if (error) toast.error(error.message);
    else { toast.success("Slot added"); refetch(); }
  };

  const deleteSlot = async (id: string) => {
    if (!confirm("Delete this slot?")) return;
    const { error } = await (supabase.from("delivery_slots") as any).delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Slot deleted"); refetch(); }
  };

  const [newSlot, setNewSlot] = useState({ slot_key: "", label: "", cutoff_time: "09:30:00" });

  return (
    <div className="space-y-4">
      {/* Add New Slot Row */}
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_120px_auto] gap-3 p-4 rounded-xl border-2 border-dashed border-primary/20 bg-primary/5">
        <div>
          <Label className="text-[10px] uppercase font-bold text-primary">Unique Key</Label>
          <Input placeholder="e.g. slot_morning" value={newSlot.slot_key} onChange={e => setNewSlot({...newSlot, slot_key: e.target.value})} className="h-9 mt-1" />
        </div>
        <div>
          <Label className="text-[10px] uppercase font-bold text-primary">Display Label</Label>
          <Input placeholder="e.g. Morning Shift" value={newSlot.label} onChange={e => setNewSlot({...newSlot, label: e.target.value})} className="h-9 mt-1" />
        </div>
        <div>
          <Label className="text-[10px] uppercase font-bold text-primary">Cutoff</Label>
          <Input type="time" step="1" value={newSlot.cutoff_time} onChange={e => setNewSlot({...newSlot, cutoff_time: e.target.value})} className="h-9 mt-1" />
        </div>
        <div className="pt-5">
          <Button onClick={() => addSlot(newSlot)} className="bg-primary text-white font-bold h-9 px-4">
            <Plus className="w-4 h-4 mr-1" /> Add
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        {(slots || []).map((slot: any) => (
          <div key={slot.id} className="flex flex-col sm:flex-row items-center gap-3 p-4 rounded-xl border border-border bg-secondary/5 group">
            <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Label</Label>
                <Input 
                  value={slot.label} 
                  onChange={e => updateSlot(slot.id, { label: e.target.value })}
                  className="h-9 mt-1"
                />
              </div>
              <div className="opacity-60">
                <Label className="text-[10px] uppercase font-bold text-muted-foreground">Key (Read Only)</Label>
                <Input value={slot.slot_key} disabled className="h-9 mt-1 bg-muted" />
              </div>
            </div>
            <div className="w-full sm:w-32">
              <Label className="text-[10px] uppercase font-bold text-muted-foreground">Cutoff</Label>
              <Input 
                type="time" 
                step="1"
                value={slot.cutoff_time} 
                onChange={e => updateSlot(slot.id, { cutoff_time: e.target.value })}
                className="h-9 mt-1"
              />
            </div>
            <div className="flex items-center gap-3 pt-5">
              <div className="flex items-center gap-2">
                <Switch 
                  checked={slot.is_active} 
                  onCheckedChange={(b) => updateSlot(slot.id, { is_active: b })}
                />
                <span className="text-[10px] font-bold uppercase text-muted-foreground">{slot.is_active ? "Active" : "Hidden"}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => deleteSlot(slot.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const DistancePricingManager = () => {
  const { data: config, refetch: refetchConfig } = useQuery({
    queryKey: ["admin_delivery_config"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("delivery_config") as any).select("*").eq("id", 1).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    }
  });

  const { data: tiers, refetch: refetchTiers } = useQuery({
    queryKey: ["admin_delivery_pricing_tiers"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("delivery_pricing_tiers") as any).select("*").order("max_distance_km", { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const [storeLat, setStoreLat] = useState("");
  const [storeLng, setStoreLng] = useState("");
  const [newTier, setNewTier] = useState({ max_distance_km: "", delivery_fee: "" });

  useEffect(() => {
    if (config) {
      setStoreLat(config.store_latitude?.toString() || "");
      setStoreLng(config.store_longitude?.toString() || "");
    }
  }, [config]);

  const saveConfig = async () => {
    try {
      const { error } = await (supabase.from("delivery_config") as any).upsert({ 
        id: 1, 
        store_latitude: Number(storeLat), 
        store_longitude: Number(storeLng) 
      });
      if (error) throw error;
      toast.success("Store coordinates saved");
      refetchConfig();
    } catch (e: any) { toast.error(e.message); }
  };

  const addTier = async () => {
    if (!newTier.max_distance_km || !newTier.delivery_fee) return toast.error("Fill all fields");
    try {
      const { error } = await (supabase.from("delivery_pricing_tiers") as any).insert([{
        max_distance_km: Number(newTier.max_distance_km),
        delivery_fee: Number(newTier.delivery_fee)
      }]);
      if (error) throw error;
      toast.success("Tier added");
      setNewTier({ max_distance_km: "", delivery_fee: "" });
      refetchTiers();
    } catch (e: any) { toast.error(e.message); }
  };

  const updateTier = async (id: string, updates: any) => {
    try {
      const { error } = await (supabase.from("delivery_pricing_tiers") as any).update(updates).eq("id", id);
      if (error) throw error;
      toast.success("Tier updated");
      refetchTiers();
    } catch (e: any) { toast.error(e.message); }
  };

  const deleteTier = async (id: string) => {
    if (!confirm("Delete this pricing tier?")) return;
    try {
      const { error } = await (supabase.from("delivery_pricing_tiers") as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Tier deleted");
      refetchTiers();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-secondary/10 p-4 rounded-xl border border-border">
        <h3 className="font-semibold text-brown mb-3 flex items-center gap-2"><MapPin className="w-4 h-4" /> Store Anchor Coordinates</h3>
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <Label>Latitude</Label>
            <Input type="number" step="0.0000001" value={storeLat} onChange={e => setStoreLat(e.target.value)} placeholder="17.5011000" />
          </div>
          <div className="flex-1">
            <Label>Longitude</Label>
            <Input type="number" step="0.0000001" value={storeLng} onChange={e => setStoreLng(e.target.value)} placeholder="78.5020000" />
          </div>
          <Button variant="hero" onClick={saveConfig}>Save Anchor</Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">The central warehouse coordinates from where all Haversine distances are calculated.</p>
      </div>

      <div>
        <h3 className="font-semibold text-brown mb-3 flex items-center gap-2"><Truck className="w-4 h-4" /> Distance Pricing Tiers</h3>
        
        <div className="grid grid-cols-[1fr_1fr_auto] gap-3 mb-4 items-end bg-primary/5 p-4 rounded-xl border border-primary/20">
          <div>
            <Label className="text-primary">Up to Distance (km)</Label>
            <Input type="number" step="0.1" value={newTier.max_distance_km} onChange={e => setNewTier({...newTier, max_distance_km: e.target.value})} placeholder="e.g. 5.0" />
          </div>
          <div>
            <Label className="text-primary">Delivery Fee (₹)</Label>
            <Input type="number" step="1" value={newTier.delivery_fee} onChange={e => setNewTier({...newTier, delivery_fee: e.target.value})} placeholder="e.g. 40" />
          </div>
          <Button variant="default" onClick={addTier}><Plus className="w-4 h-4 mr-1" /> Add Tier</Button>
        </div>

        <div className="space-y-2">
          {(tiers || []).map((tier: any) => (
            <div key={tier.id} className="flex gap-3 items-center bg-card p-3 rounded-xl border border-border">
              <div className="flex-1 flex gap-3">
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Up to (km)</Label>
                  <Input type="number" step="0.1" value={tier.max_distance_km} onChange={e => updateTier(tier.id, { max_distance_km: Number(e.target.value) })} />
                </div>
                <div className="flex-1">
                  <Label className="text-[10px] text-muted-foreground uppercase">Fee (₹)</Label>
                  <Input type="number" step="1" value={tier.delivery_fee} onChange={e => updateTier(tier.id, { delivery_fee: Number(e.target.value) })} />
                </div>
              </div>
              <Button variant="ghost" size="icon" className="mt-5" onClick={() => deleteTier(tier.id)}>
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            </div>
          ))}
          {tiers?.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">No pricing tiers defined. Add a tier to start charging.</p>}
        </div>
      </div>
    </div>
  );
};

export default AdminSettings;