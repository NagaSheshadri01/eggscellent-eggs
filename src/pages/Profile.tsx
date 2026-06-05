import { Component, ReactNode, useEffect, useRef, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import Header from "@/components/site/Header";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, AlertCircle, Mail, Phone, User as UserIcon, MapPin, LogOut, ShieldCheck, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import AddressPicker from "@/components/site/AddressPicker";
import JitVerifySheet from "@/components/site/JitVerifySheet";
import { useProfileCompleteness } from "@/hooks/useProfileCompleteness";
import { Link, useSearchParams } from "react-router-dom";
import { userService, displayEmail, isSyntheticEmail } from "@/lib/services/user.service";

class ProfileErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error) { console.error("Profile page failed", error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-card rounded-3xl shadow-soft p-6 space-y-3">
          <h2 className="font-display font-bold text-brown text-xl">Complete your Profile</h2>
          <p className="text-sm text-muted-foreground">We couldn't load your profile. Refresh the page or add your details again.</p>
          <Button variant="hero" onClick={() => window.location.reload()}>Reload profile</Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const Badge = ({ ok, label }: { ok: boolean; label: string }) => (
  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${ok ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"}`}>
    {ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />} {label}
  </span>
);

const Profile = () => {
  const { user, signOut, isAdmin, loading: authLoading } = useAuth();
  const { profile, hasName, hasEmail, hasPhone, refetch, isLoading, isError, error } = useProfileCompleteness();
  const [name, setName] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [verifyOpen, setVerifyOpen] = useState<null | "phone" | "email" | "name">(null);
  const [savingName, setSavingName] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [params, setParams] = useSearchParams();
  const addrRef = useRef<HTMLDivElement | null>(null);
  const hydrated = useRef(false);

  useEffect(() => {
    if (!hydrated.current && profile) {
      setName(profile.full_name ?? "");
      setEmail(displayEmail(profile.email));
      hydrated.current = true;
    }
  }, [profile]);

  useEffect(() => {
    if (!authLoading && user && !profile && !isLoading && !isError) {
      refetch();
    }
  }, [authLoading, user, profile, isLoading, isError, refetch]);

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
    try {
      await userService.updateProfile(user.id, { full_name: name });
      toast.success("Name saved");
      refetch();
    } catch (e: any) { toast.error(e.message); }
    finally { setSavingName(false); }
  };

  const saveEmail = async () => {
    if (!user) return;
    const e = email.trim();
    if (!/^\S+@\S+\.\S+$/.test(e)) return toast.error("Enter a valid email");
    setSavingEmail(true);
    try {
      const currentReal = displayEmail(profile?.email);
      if (e.toLowerCase() !== currentReal.toLowerCase()) {
        if (await userService.emailExists(e)) {
          throw new Error("This email is already used");
        }
      }
      await userService.updateProfile(user.id, { email: e });
      toast.success("Email saved");
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingEmail(false); }
  };

  const showSkeleton = (authLoading || isLoading) && !profile;

  return (
    <div className="min-h-screen bg-background">
      <Seo title="My profile — Eggscellent" />
      <Header />
      <main className="container max-w-3xl py-10 space-y-6">
        <ProfileErrorBoundary>
        {showSkeleton ? (
          <>
            <div className="flex items-center gap-4">
              <Skeleton className="w-16 h-16 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-7 w-48" />
                <Skeleton className="h-4 w-64" />
              </div>
            </div>
            <Skeleton className="h-64 rounded-3xl" />
            <Skeleton className="h-40 rounded-3xl" />
          </>
        ) : isError ? (
          <section className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 space-y-4">
            <h1 className="font-display font-bold text-brown text-3xl tracking-tight">Complete your Profile</h1>
            <p className="text-sm text-muted-foreground">{(error as Error)?.message || "We couldn't load your profile details."}</p>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Display name</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
              </div>
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
              </div>
            </div>
            <Button variant="hero" onClick={() => { void saveName(); if (email.trim()) void saveEmail(); }}>
              Save profile
            </Button>
          </section>
        ) : (
          <>
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                {profile?.avatar_url && <AvatarImage src={profile.avatar_url} alt={profile?.full_name || "You"} />}
                <AvatarFallback className="bg-secondary text-brown font-display font-bold">
                  {(profile?.full_name || displayEmail(profile?.email) || profile?.phone || "U").slice(0, 1).toUpperCase()}
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
                {isSyntheticEmail(profile?.email) && !email && (
                  <p className="text-xs text-muted-foreground">Add an email so we can send order receipts.</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Phone className="w-4 h-4 text-primary" /> Phone (verified — locked)</Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Lock className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
                    <Input disabled value={profile?.phone || ""} className="pl-9 bg-secondary/30 text-muted-foreground" placeholder="Not added" />
                  </div>
                  {!hasPhone && <Button variant="outline" onClick={() => setVerifyOpen("phone")}>Verify</Button>}
                </div>
              </div>
            </section>

            <section ref={addrRef} className="bg-card rounded-3xl shadow-soft p-5 sm:p-6 space-y-4">
              <h2 className="font-display font-bold text-brown text-lg flex items-center gap-2">
                <MapPin className="w-5 h-5 text-primary" /> Saved addresses
              </h2>
              <p className="text-xs text-muted-foreground -mt-2">Your default address will be auto-selected at checkout.</p>
              <AddressPicker manageMode />
            </section>

            <div className="flex justify-between">
              <Button variant="ghost" onClick={signOut}><LogOut className="w-4 h-4" /> Sign out</Button>
              <Link to="/orders" className="text-sm font-semibold text-brown hover:underline">View orders →</Link>
            </div>
          </>
        )}
        </ProfileErrorBoundary>
      </main>

      <JitVerifySheet
        open={!!verifyOpen}
        missing={verifyOpen === "phone" ? "phone" : "phone"}
        onOpenChange={(o) => !o && setVerifyOpen(null)}
        onComplete={() => { setVerifyOpen(null); refetch(); }}
      />
    </div>
  );
};

export default Profile;
