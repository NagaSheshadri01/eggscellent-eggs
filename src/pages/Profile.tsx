import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { CheckCircle2, AlertCircle, Mail, Phone, User as UserIcon, MapPin, LogOut, ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AddressPicker from "@/components/site/AddressPicker";
import JitVerifySheet from "@/components/site/JitVerifySheet";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import { Link, useSearchParams } from "react-router-dom";

const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ok ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>
    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {label}
  </span>
);

const Profile = () => {
  const { user, signOut, isAdmin } = useAuth();
  const { profile, hasName, hasEmail, hasPhone, refetch } = useProfileCompleteness();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [verifyOpen, setVerifyOpen] = useState<null | "phone" | "email" | "name">(null);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [params, setParams] = useSearchParams();
  const addrRef = useRef<HTMLDivElement | null>(null);
  const hydrated = useRef(false);

  // Hydrate inputs from profile once it loads
  useEffect(() => {
    if (!hydrated.current && profile) {
      setName(profile.full_name ?? "");
      setEmail(profile.email ?? "");
      hydrated.current = true;
    }
  }, [profile]);

  // If redirected here to add an address, scroll to address section
  useEffect(() => {
    if (params.get("addAddress") === "1" && addrRef.current) {
      addrRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      toast.message("Add or pick a delivery address, then try subscribing again.");
      params.delete("addAddress");
      setParams(params, { replace: true });
    }
  }, [params, setParams]);

  const saveName = async () => {
    if (!user || !name.trim()) return toast.error("Enter your name");
    setSavingName(true);
    const { error } = await supabase.from("profiles").update({ full_name: name.trim() }).eq("id", user.id);
    setSavingName(false);
    if (error) toast.error(error.message);
    else { toast.success("Name saved"); refetch(); }
  };

  const saveEmail = async () => {
    if (!user) return;
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("Enter a valid email");
    setSavingEmail(true);
    if (e.toLowerCase() !== (profile?.email ?? "").toLowerCase()) {
      const { data: exists } = await supabase.rpc("email_exists", { _email: e });
      if (exists) { setSavingEmail(false); return toast.error("This email is already used"); }
    }
    const { error } = await supabase.from("profiles").update({ email: e }).eq("id", user.id);
    setSavingEmail(false);
    if (error) toast.error(error.message);
    else { toast.success("Email saved"); refetch(); }
  };

  return (
    <div className="min-h-screen bg-background">
      <Seo title="My profile — Eggscellent" />
      <Header />
      <main className="container max-w-3xl py-10 space-y-6">
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.full_name || "You"} />}
            <AvatarFallback className="bg-secondary text-brown font-display font-bold">
              {(profile?.full_name || profile?.email || "U").slice(0, 1).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h1 className="font-display font-bold text-brown text-3xl tracking-tight">{profile?.full_name || "Welcome"}</h1>
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge ok={hasPhone} label="Phone verified" />
              <Badge ok={hasEmail} label="Email set" />
              <Badge ok={hasName} label="Name set" />
              {isAdmin && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-brown text-primary">
                  <ShieldCheck className="w-3.5 h-3.5" /> Admin
                </span>
              )}
            </div>
          </div>
        </div>

        <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 space-y-4">
          <h2 className="font-display font-bold text-brown text-lg flex items-center gap-2"><UserIcon className="w-5 h-5 text-primary" /> Identity</h2>

          <div className="space-y-1.5">
            <Label>Display name</Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              <Button variant="brown" onClick={saveName} disabled={savingName}>
                {savingName && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="flex items-center gap-1.5"><Mail className="w-4 h-4 text-primary" /> Email</Label>
            <div className="flex gap-2">
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              <Button variant="brown" onClick={saveEmail} disabled={savingEmail}>
                {savingEmail && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </Button>
            </div>
          </div>

          <div className="p-3 rounded-xl border border-border flex items-center gap-3">
            <Phone className="w-4 h-4 text-primary" />
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground">Phone</div>
              <div className="font-semibold text-brown text-sm truncate">{profile?.phone || "Not added"}</div>
            </div>
            {!hasPhone && <Button size="sm" variant="outline" onClick={() => setVerifyOpen("phone")}>Verify</Button>}
          </div>
        </section>

        <section ref={addrRef} className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 space-y-4">
          <h2 className="font-display font-bold text-brown text-lg flex items-center gap-2"><MapPin className="w-5 h-5 text-primary" /> Address book</h2>
          <AddressPicker manageMode />
        </section>

        <div className="flex justify-between">
          <Button variant="ghost" onClick={signOut}><LogOut className="w-4 h-4" /> Sign out</Button>
          <Link to="/orders" className="text-sm font-semibold text-brown hover:underline">View orders →</Link>
        </div>
      </main>

      <JitVerifySheet
        open={!!verifyOpen}
        missing={verifyOpen}
        onOpenChange={(o) => !o && setVerifyOpen(null)}
        onComplete={() => { setVerifyOpen(null); refetch(); }}
      />
    </div>
  );
};

export default Profile;
