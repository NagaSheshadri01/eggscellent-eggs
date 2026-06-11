import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import { userService } from "@/lib/services/user.service";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { MapPin, Navigation, Pencil, Loader2, Plus, Trash2, Star, ArrowLeft } from "lucide-react";
import LocationBlockedDialog from "@/components/site/LocationBlockedDialog";

export type Address = {
  id: string;
  label?: string | null;
  address_tag?: string | null;
  address_name?: string | null;
  address_phone?: string | null;
  area_locality?: string | null;
  full_name: string;
  phone: string;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  state: string;
  pincode: string;
  landmark?: string | null;
  is_default: boolean;
};

type Mode = "list" | "choose" | "auto" | "manual";

type DraftAddress = Partial<Address> & { email?: string; lat?: number; lng?: number; isLocationLocked?: boolean };

const empty: DraftAddress = { address_tag: "Home" };

type Props = {
  selectedId?: string;
  onSelect?: (id: string) => void;
  showSelect?: boolean; // if true, list shows radio for checkout selection
  manageMode?: boolean; // if true, list shows edit/delete/default actions
};

export const AddressPicker = ({ selectedId, onSelect, showSelect = false, manageMode = false }: Props) => {
  const { user } = useAuth();
  const [list, setList] = useState<Address[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<Mode>("list");
  const [draft, setDraft] = useState<DraftAddress>(empty);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isPincodeValid, setIsPincodeValid] = useState(true);
  const [checkingPincode, setCheckingPincode] = useState(false);
  
  const { profile, hasEmail, refetch: refetchProfile } = useProfileCompleteness();
  const [busy, setBusy] = useState(false);
  const [blockedOpen, setBlockedOpen] = useState(false);

  const load = async () => {
    if (!user) return;
    const { data } = await (supabase as any)
      .from("addresses")
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as Address[];
    setList(rows);
    setLoaded(true);
    if (rows.length === 0) setMode("choose");
    if (showSelect && rows.length && !selectedId) onSelect?.(rows[0].id);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [user]);

  // Simple Profile Auto-fill (phone, name, email)
  useEffect(() => {
    const fetchProfile = async () => {
      if (!user?.id) return;
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("phone, full_name, email")
        .eq("id", user.id)
        .single();

      if (data && !error) {
        setDraft(prev => ({
          ...prev,
          phone: prev.phone || data.phone || "",
          full_name: prev.full_name || data.full_name || "",
          // Pre-fill email from profile so it's ready without manual typing
          email: prev.email || (data.email && !/auth\.eggscellent\.app$/i.test(data.email) ? data.email : "") || "",
        }));
      }
    };
    fetchProfile();
  }, [user]);

  const reset = () => {
    setDraft({
      address_tag: "Home",
      full_name: profile?.full_name || "",
      phone: profile?.phone || "",
      email: profile?.email || "",
      isLocationLocked: false,
    });
    setEditingId(null);
  };

  const startEdit = (a: Address) => {
    setDraft(a);
    setEditingId(a.id);
    setMode("manual");
  };

  const runGeolocation = () => {
    setBusy(true);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setDraft({
        address_tag: "Home",
        full_name: profile?.full_name || "",
        phone: profile?.phone || "",
        email: profile?.email || "",
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        isLocationLocked: true
      });
      setIsPincodeValid(true);
      setMode("manual");
      setBusy(false);
    }, (err) => {
      setBusy(false);
      if (err.code === err.PERMISSION_DENIED) {
        setBlockedOpen(true);
      } else {
        toast.error("Couldn't get your location");
      }
    });
  };

  const validatePincode = async (pc: string) => {
    if (!pc || !/^\d{6}$/.test(pc)) {
      setIsPincodeValid(false);
      return;
    }
    setCheckingPincode(true);
    const { data } = await (supabase as any).from("serviceable_pincodes").select("pincode").eq("pincode", pc).eq("active", true).maybeSingle();
    setCheckingPincode(false);
    setIsPincodeValid(!!data);
  };

  const detect = async () => {
    if (!navigator.geolocation) return toast.error("Geolocation not supported");
    // Detect if permission was previously denied at the browser level
    try {
      // @ts-ignore — Permissions API
      if (navigator.permissions?.query) {
        // @ts-ignore
        const status = await navigator.permissions.query({ name: "geolocation" });
        if (status.state === "denied") {
          setBlockedOpen(true);
          return;
        }
      }
    } catch { /* fall through */ }
    runGeolocation();
  };

  const save = async () => {
    if (!user) return;
    const required = ["full_name","phone","address_line_1","city","state","pincode"] as const;
    for (const k of required) if (!draft[k]?.trim()) return toast.error("Please fill all required fields");

    if (!draft.email?.trim()) return toast.error("Please provide an email for order receipts");
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.email.trim());
    if (!emailOk) return toast.error("Please enter a valid email address");

    setBusy(true);
    
    // Save profile atomic updates if needed
    let profileUpdated = false;
    if (draft.full_name && draft.full_name !== profile?.full_name) {
      await userService.updateProfile(user.id, { full_name: draft.full_name });
      profileUpdated = true;
    }
    if (!hasEmail && draft.email) {
      await userService.updateProfile(user.id, { email: draft.email });
      profileUpdated = true;
    }
    if (profileUpdated) refetchProfile();

    const payload = {
      user_id: user.id,
      address_tag: draft.address_tag || "Home",
      address_name: draft.address_name || null,
      full_name: draft.full_name!, phone: draft.phone!,
      address_line_1: draft.address_line_1!,
      area_locality: draft.area_locality || draft.address_line_2 || null,
      city: "Hyderabad", state: "Telangana", pincode: draft.pincode!,
      landmark: draft.landmark || null,
      is_default: draft.is_default ?? list.length === 0,
      lat: draft.lat, lng: draft.lng,
      email: draft.email?.trim() || null,
    } as any;
    let res;
    if (editingId) {
      res = await (supabase as any).from("addresses").update(payload).eq("id", editingId).select().single();
    } else {
      res = await (supabase as any).from("addresses").insert(payload).select().single();
    }
    setBusy(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(editingId ? "Address updated" : "Address saved");
    reset();
    setMode("list");
    await load();
    if (showSelect && !editingId && res.data) onSelect?.((res.data as Address).id);
  };

  const del = async (id: string) => {
    if (!confirm("Delete this address?")) return;
    const { error } = await (supabase as any).from("addresses").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    load();
  };

  const setDefault = async (id: string) => {
    if (!user) return;
    await (supabase as any).from("addresses").update({ is_default: false }).eq("user_id", user.id);
    await (supabase as any).from("addresses").update({ is_default: true }).eq("id", id);
    toast.success("Default address set");
    load();
  };

  if (!loaded) return <div className="h-32 grid place-items-center text-muted-foreground"><Loader2 className="w-5 h-5 animate-spin" /></div>;

  const blockedDialog = (
    <LocationBlockedDialog
      open={blockedOpen}
      onOpenChange={setBlockedOpen}
      onRetry={runGeolocation}
      onManual={() => { reset(); setMode("manual"); }}
    />
  );

  // Choose flow (auto vs manual)
  if (mode === "choose") {
    return (
      <div className="space-y-3">
        {blockedDialog}
        {list.length > 0 && (
          <button onClick={() => { reset(); setMode("list"); }} className="text-xs text-muted-foreground hover:text-brown flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>
        )}
        <button onClick={detect} disabled={busy} className="w-full text-left p-6 rounded-2xl border-2 border-primary hover:bg-primary/5 transition-smooth bg-card flex flex-col items-center justify-center gap-3 text-center shadow-soft">
          <div className="w-14 h-14 rounded-full gradient-yolk grid place-items-center shrink-0 shadow-md">
            <Navigation className="w-6 h-6 text-brown" />
          </div>
          <div>
            <div className="font-display font-bold text-brown text-lg">📍 Auto-Detect My Doorstep Pin</div>
            <div className="text-xs text-muted-foreground mt-1 max-w-[200px] mx-auto">Use your device's hardware GPS to pinpoint your exact location for precise delivery tracking.</div>
          </div>
          {busy && <Loader2 className="w-5 h-5 animate-spin text-primary mt-2" />}
        </button>
      </div>
    );
  }

  // Manual / auto-fill form
  if (mode === "manual" || mode === "auto") {
    if (!draft.isLocationLocked && !editingId) {
      return (
        <div className="space-y-3">
          {blockedDialog}
          <button onClick={() => { reset(); setMode(list.length ? "list" : "choose"); }} className="text-xs text-muted-foreground hover:text-brown flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>
          <div className="p-8 text-center bg-amber-50 rounded-2xl border border-amber-200">
            <Navigation className="w-8 h-8 text-amber-500 mx-auto mb-3 opacity-50" />
            <h3 className="font-bold text-amber-900 mb-1">GPS Lock Required</h3>
            <p className="text-xs text-amber-700 mb-4">You must securely lock your geospatial coordinates first before entering address details.</p>
            <Button variant="hero" onClick={detect} disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : "📍 Auto-Detect My Doorstep Pin"}
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {blockedDialog}
        <button onClick={() => { reset(); setMode(list.length ? "list" : "choose"); }} className="text-xs text-muted-foreground hover:text-brown flex items-center gap-1"><ArrowLeft className="w-3 h-3" /> Back</button>

        <div className="space-y-2">
          <Label>Location Tag</Label>
          <div className="flex flex-wrap gap-2">
            {["Home", "Work", "Custom"].map(l => (
              <button key={l} type="button" onClick={() => setDraft(d => ({ ...d, address_tag: l }))} className={`px-4 py-2 rounded-full text-sm font-semibold border transition-smooth ${draft.address_tag === l ? "border-primary bg-primary/10 text-brown shadow-sm" : "border-border text-muted-foreground hover:bg-secondary/50"}`}>{l === 'Home' ? '🏠 Home' : l === 'Work' ? '💼 Work' : '✨ Custom'}</button>
            ))}
          </div>
          {draft.address_tag === "Custom" && (
            <div className="mt-3 animate-in fade-in slide-in-from-top-2">
              <Input
                value={draft.address_name || ""}
                onChange={e => setDraft(d => ({ ...d, address_name: e.target.value }))}
                placeholder="E.g. Gym, Parents' House"
                autoFocus
              />
            </div>
          )}
        </div>

        <div className="bg-secondary/10 p-4 rounded-2xl border border-border space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <Label>Full Name *</Label>
              <Input
                value={draft.full_name || ""}
                onChange={e => setDraft(d => ({ ...d, full_name: e.target.value }))}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label>Phone Number *</Label>
              <Input
                value={draft.phone || ""}
                onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                placeholder="+91 …"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Flat / Door / Building Name *</Label>
              <Input
                value={draft.address_line_1 || ""}
                onChange={e => setDraft(d => ({ ...d, address_line_1: e.target.value }))}
                placeholder="Flat 302, Green Valley Apts"
              />
            </div>
            <div className="sm:col-span-2">
              <Label>Area / Locality *</Label>
              <Input
                value={draft.area_locality || ""}
                onChange={e => setDraft(d => ({ ...d, area_locality: e.target.value }))}
                placeholder="Kondapur, Secunderabad"
              />
            </div>
            <div className="relative sm:col-span-2">
              <Label>6-Digit Pincode *</Label>
              <Input
                value={draft.pincode || ""}
                onChange={e => {
                  const val = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setDraft(d => ({ ...d, pincode: val }));
                  if (val.length === 6) validatePincode(val);
                  else setIsPincodeValid(true);
                }}
                onBlur={e => validatePincode(e.target.value)}
                className={!isPincodeValid && draft.pincode?.length === 6 ? "border-destructive focus-visible:ring-destructive" : ""}
                placeholder="500001"
              />
              {!isPincodeValid && draft.pincode?.length === 6 && (
                <p className="text-[10px] text-destructive font-bold mt-1 animate-in fade-in slide-in-from-top-1">This pincode is outside our delivery zone.</p>
              )}
              {checkingPincode && <Loader2 className="w-4 h-4 animate-spin absolute right-3 top-8 text-muted-foreground" />}
            </div>
            {/* Keeping Email for receipt reasons as per previous requirement but hiding city/state as they are default Hyderabad */}
            <div className="sm:col-span-2 hidden">
              <Label>Email</Label>
              <Input
                type="email"
                value={draft.email || ""}
                onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <Button variant="hero" className="w-full h-12 text-base shadow-lg" onClick={save} disabled={busy || !isPincodeValid || checkingPincode}>
          {busy || checkingPincode ? <Loader2 className="w-5 h-5 animate-spin" /> : (!isPincodeValid ? "Location Not Serviceable" : (editingId ? "Update Address" : "Save Secure Address"))}
        </Button>
      </div>
    );
  }

  // List
  return (
    <div className="space-y-3">
      {blockedDialog}
      {showSelect ? (
        <RadioGroup value={selectedId} onValueChange={onSelect} className="space-y-2">
          {list.map(a => (
            <label key={a.id} className={`flex gap-3 p-4 rounded-2xl border cursor-pointer transition-smooth ${selectedId === a.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
              <RadioGroupItem value={a.id} className="mt-1" />
              <div className="flex-1 text-sm min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {a.address_tag && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-secondary text-brown">{a.address_tag === 'Custom' ? a.address_name : a.address_tag}</span>}
                  {a.is_default && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-primary/20 text-brown">Default</span>}
                  <span className="font-semibold text-brown">{a.full_name}</span>
                  <span className="text-muted-foreground">· {a.phone}</span>
                </div>
                <div className="text-muted-foreground mt-1">{a.address_line_1}{a.area_locality ? `, ${a.area_locality}` : ""}</div>
                <div className="text-muted-foreground">{a.city}, {a.state} {a.pincode}</div>
              </div>
            </label>
          ))}
        </RadioGroup>
      ) : (
        <div className="space-y-2">
          {list.map(a => (
            <div key={a.id} className="p-4 rounded-2xl border border-border bg-card">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-secondary grid place-items-center shrink-0"><MapPin className="w-5 h-5 text-brown" /></div>
                <div className="flex-1 min-w-0 text-sm">
                  <div className="flex items-center gap-2 flex-wrap">
                    {a.address_tag && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-secondary text-brown">{a.address_tag === 'Custom' ? a.address_name : a.address_tag}</span>}
                    {a.is_default && <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md bg-primary/20 text-brown">Default</span>}
                    <span className="font-semibold text-brown">{a.full_name}</span>
                    <span className="text-muted-foreground">· {a.phone}</span>
                  </div>
                  <div className="text-muted-foreground mt-1">{a.address_line_1}{a.area_locality ? `, ${a.area_locality}` : ""}</div>
                  <div className="text-muted-foreground">{a.city}, {a.state} {a.pincode}</div>
                </div>
              </div>
              {manageMode && (
                <div className="flex gap-1 justify-end mt-2">
                  {!a.is_default && <Button size="sm" variant="ghost" onClick={() => setDefault(a.id)}><Star className="w-4 h-4" /> Set default</Button>}
                  <Button size="sm" variant="ghost" onClick={() => startEdit(a)}><Pencil className="w-4 h-4" /></Button>
                  <Button size="sm" variant="ghost" onClick={() => del(a.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Button variant="outline" className="w-full" onClick={() => { reset(); setMode("choose"); }}>
        <Plus className="w-4 h-4" /> Use another location
      </Button>
    </div>
  );
};

export default AddressPicker;