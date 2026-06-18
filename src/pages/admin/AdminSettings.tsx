import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Trash2, Plus, MapPin, Truck, Building2, Clock, Navigation, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAppSettings, useUpdateAppSetting } from "@/hooks/useAppSettings";
import { usePincodes, useUpsertPincode, useDeletePincode } from "@/hooks/useServiceablePincodes";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, Marker, useMap, AttributionControl } from "react-leaflet";
import L from "leaflet";

// Leaflet icon fix
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const MapController = ({ center }: { center: { lat: number; lng: number } }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const DraggableMarker = ({ position, setPosition }: any) => {
  return (
    <Marker
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const marker = e.target;
          const pos = marker.getLatLng();
          setPosition({ lat: pos.lat, lng: pos.lng });
        },
      }}
      position={position}
    />
  );
};

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

  const [minOrderValue, setMinOrderValue] = useState<number>(150);
  const [storeAnchor, setStoreAnchor] = useState({ lat: 17.5011000, lng: 78.5020000 });
  const [deliveryTiers, setDeliveryTiers] = useState<Array<{ from_km: any; to_km: any; price: any }>>([]);
  const [newTier, setNewTier] = useState({ from_km: "", to_km: "", price: "" });
  const [isDetecting, setIsDetecting] = useState(false);

  useEffect(() => {
    if (config) {
      setStoreAnchor({
        lat: config.store_latitude || 17.5011000,
        lng: config.store_longitude || 78.5020000
      });
      setMinOrderValue(config.min_order_value || 150);
      setDeliveryTiers(config.delivery_tiers || []);
    }
  }, [config]);

  const handleLocationDiscovery = () => {
    setIsDetecting(true);
    if (!navigator.geolocation || !window.isSecureContext) {
      toast.error("Geolocation is not supported or context is not secure.");
      setIsDetecting(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStoreAnchor({ lat: position.coords.latitude, lng: position.coords.longitude });
        setIsDetecting(false);
        toast.success("Store location detected via GPS!");
      },
      (error) => {
        toast.error("Failed to lock GPS: " + error.message);
        setIsDetecting(false);
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSaveCoreConfig = async () => {
    try {
      const { error } = await (supabase as any)
        .from('delivery_config')
        .update({
          store_latitude: parseFloat(storeAnchor.lat.toString()),
          store_longitude: parseFloat(storeAnchor.lng.toString()),
          min_order_value: Number(minOrderValue)
        })
        .eq('id', 1);

      if (error) throw error;
      toast.success("Core warehouse configurations updated successfully!");
      refetchConfig();
    } catch (err: any) {
      console.error(err);
      toast.error(`Core configuration save failed: ${err.message}`);
    }
  };

  const handleSavePricingTiers = async () => {
    try {
      if (!deliveryTiers || deliveryTiers.length === 0) {
        toast.error("Please add at least one distance bracket tier before saving.");
        return;
      }

      const sanitizedTiers = deliveryTiers.map(tier => ({
        from_km: Number(tier.from_km),
        to_km: Number(tier.to_km),
        price: Number(tier.price)
      })).sort((a, b) => a.from_km - b.from_km);

      const { error } = await (supabase as any)
        .from('delivery_config')
        .update({
          delivery_tiers: sanitizedTiers
        })
        .eq('id', 1);

      if (error) throw error;
      setDeliveryTiers(sanitizedTiers);
      toast.success("Distance pricing tiers locked and saved to database!");
      refetchConfig();
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to save pricing matrix: ${err.message}`);
    }
  };

  const addTier = () => {
    if (newTier.from_km === "" || newTier.to_km === "" || newTier.price === "") return toast.error("Fill all fields");
    const updatedTiers = [...deliveryTiers, { from_km: Number(newTier.from_km), to_km: Number(newTier.to_km), price: Number(newTier.price) }];
    updatedTiers.sort((a, b) => Number(a.from_km) - Number(b.from_km));
    setDeliveryTiers(updatedTiers);
    setNewTier({ from_km: "", to_km: "", price: "" });
  };

  const updateTier = (index: number, field: string, val: any) => {
    const updated = [...deliveryTiers];
    updated[index] = { ...updated[index], [field]: val };
    setDeliveryTiers(updated);
  };

  const deleteTier = (index: number) => {
    if (!confirm("Delete this pricing tier?")) return;
    const updated = [...deliveryTiers];
    updated.splice(index, 1);
    setDeliveryTiers(updated);
  };

  return (
    <div className="space-y-8 p-6 max-w-4xl mx-auto">
      
      {/* CARD 1: CORE CONFIGURATION & ANCHOR */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2"><MapPin className="w-5 h-5 text-amber-600" /> Store Anchor & Core Rules</h3>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-stone-500">Latitude</label>
            <input type="number" step="0.0000001" value={storeAnchor.lat} onChange={(e) => setStoreAnchor({...storeAnchor, lat: parseFloat(e.target.value)})} className="w-full p-2 border rounded-lg mt-1 bg-stone-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500">Longitude</label>
            <input type="number" step="0.0000001" value={storeAnchor.lng} onChange={(e) => setStoreAnchor({...storeAnchor, lng: parseFloat(e.target.value)})} className="w-full p-2 border rounded-lg mt-1 bg-stone-50" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500">Minimum Order Value (₹)</label>
            <input type="number" step="1" value={minOrderValue} onChange={(e) => setMinOrderValue(Number(e.target.value))} className="w-full p-2 border rounded-lg mt-1 bg-stone-50" />
          </div>
        </div>

        <div className="flex gap-3 mt-2">
          <Button variant="outline" className="flex-1 bg-white border-stone-200 hover:bg-stone-50 text-stone-700" onClick={handleLocationDiscovery} disabled={isDetecting}>
            {isDetecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Navigation className="w-4 h-4 mr-2" />} Auto-Detect Anchor
          </Button>
        </div>

        <div className="mt-4 w-full h-64 rounded-xl overflow-hidden border border-stone-200 z-0 relative shadow-inner">
          <MapContainer center={[storeAnchor.lat || 17.5011, storeAnchor.lng || 78.5020]} zoom={15} style={{ height: "100%", width: "100%", zIndex: 0 }} attributionControl={false}>
            <TileLayer url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}" attribution='&copy; <a href="https://maps.google.com">Google Maps</a>' />
            <AttributionControl prefix={false} />
            <MapController center={{ lat: storeAnchor.lat || 17.5011, lng: storeAnchor.lng || 78.5020 }} />
            {storeAnchor.lat && storeAnchor.lng && (
              <DraggableMarker 
                position={[storeAnchor.lat, storeAnchor.lng]} 
                setPosition={(pos: any) => setStoreAnchor({ lat: pos.lat, lng: pos.lng })} 
              />
            )}
          </MapContainer>
          <div className="absolute top-2 left-2 right-2 bg-white/90 backdrop-blur text-xs p-2 rounded-lg border border-stone-200 shadow-sm text-center font-medium z-[1000] pointer-events-none text-stone-700">
            Drag the pin precisely over your warehouse location.
          </div>
        </div>

        <button onClick={handleSaveCoreConfig} className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition-all shadow-sm mt-2">
          Save Core Settings
        </button>
      </div>

      {/* CARD 2: STEP-TIER DISTANCE PRICING MATRIX */}
      <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-sm space-y-4">
        <h3 className="text-lg font-bold text-stone-800 flex items-center gap-2"><Truck className="w-5 h-5 text-stone-700" /> Distance Pricing Tiers Matrix</h3>
        
        <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-3 mb-4 items-end bg-stone-50 p-4 rounded-xl border border-stone-200">
          <div>
            <label className="text-xs font-semibold text-stone-500">From (km)</label>
            <input type="number" step="0.1" value={newTier.from_km} onChange={e => setNewTier({...newTier, from_km: e.target.value})} placeholder="e.g. 0" className="w-full p-2 border rounded-lg mt-1 bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500">To (km)</label>
            <input type="number" step="0.1" value={newTier.to_km} onChange={e => setNewTier({...newTier, to_km: e.target.value})} placeholder="e.g. 3" className="w-full p-2 border rounded-lg mt-1 bg-white" />
          </div>
          <div>
            <label className="text-xs font-semibold text-stone-500">Delivery Fee (₹)</label>
            <input type="number" step="1" value={newTier.price} onChange={e => setNewTier({...newTier, price: e.target.value})} placeholder="e.g. 30" className="w-full p-2 border rounded-lg mt-1 bg-white" />
          </div>
          <Button variant="default" onClick={addTier} className="bg-stone-800 hover:bg-stone-900 text-white h-[42px]"><Plus className="w-4 h-4 mr-1" /> Add Tier</Button>
        </div>

        <div className="space-y-2">
          {deliveryTiers.map((tier, idx) => (
            <div key={idx} className="flex gap-3 items-center bg-white p-3 rounded-xl border border-stone-200">
              <div className="flex-1 flex gap-3">
                <div className="flex-1">
                  <label className="text-[10px] text-stone-500 uppercase font-bold">From (km)</label>
                  <input type="number" step="0.1" value={tier.from_km} onChange={e => updateTier(idx, 'from_km', e.target.value)} className="w-full p-2 border rounded-lg mt-1 bg-stone-50" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-stone-500 uppercase font-bold">To (km)</label>
                  <input type="number" step="0.1" value={tier.to_km} onChange={e => updateTier(idx, 'to_km', e.target.value)} className="w-full p-2 border rounded-lg mt-1 bg-stone-50" />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] text-stone-500 uppercase font-bold">Fee (₹) (0 = Free)</label>
                  <input type="number" step="1" value={tier.price} onChange={e => updateTier(idx, 'price', e.target.value)} className="w-full p-2 border rounded-lg mt-1 bg-stone-50" />
                </div>
              </div>
              <Button variant="ghost" size="icon" className="mt-6 hover:bg-red-50" onClick={() => deleteTier(idx)}>
                <Trash2 className="w-4 h-4 text-red-500" />
              </Button>
            </div>
          ))}
          {deliveryTiers.length === 0 && <p className="text-sm text-center text-stone-500 py-4 font-medium">No pricing tiers defined. Add a tier to start charging.</p>}
        </div>

        <button onClick={handleSavePricingTiers} className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 text-white font-bold rounded-xl transition-all shadow-sm mt-4">
          Save Distance Pricing Matrix
        </button>
      </div>

    </div>
  );
};

export default AdminSettings;