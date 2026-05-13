import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { Loader2, Mail, Phone, User as UserIcon, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { useInvalidateProfile } from "@/hooks/useProfileCompleteness";
import { userService } from "@/lib/services/user.service";

type Missing = "phone" | "email" | "name" | null;

type Props = {
  open: boolean;
  missing: Missing;
  /** When true, the user can't dismiss until verified (used in checkout). */
  blocking?: boolean;
  onOpenChange?: (open: boolean) => void;
  onComplete?: () => void;
};

const JitVerifySheet = ({ open, missing, blocking = false, onOpenChange, onComplete }: Props) => {
  const { user } = useAuth();
  const invalidateProfile = useInvalidateProfile();
  const [busy, setBusy] = useState(false);

  // phone
  const [phone, setPhone] = useState("");
  const [stage, setStage] = useState<"input" | "code">("input");
  const [otp, setOtp] = useState("");

  // email + name
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) {
      setStage("input"); setOtp(""); setPhone(""); setEmail(""); setName("");
    }
  }, [open]);

  const sendPhoneOtp = async () => {
    const norm = phone.replace(/\s/g, "");
    if (!/^\+?\d{10,15}$/.test(norm)) return toast.error("Enter a valid phone number");
    setBusy(true);
    const { data: exists } = await supabase.rpc("phone_exists", { _phone: norm });
    if (exists) { setBusy(false); return toast.error("This phone is already linked to another account"); }
    const { data, error } = await supabase.functions.invoke("phone-auth", { body: { action: "send-otp", phone: norm } });
    setBusy(false);
    if (error || !data?.ok) return toast.error(data?.error || error?.message || "Couldn't send OTP");
    setStage("code");
    toast.success(`OTP sent (demo code: ${data.devCode})`, { duration: 8000 });
  };

  const verifyPhoneAndLink = async () => {
    if (!user || otp.length !== 6) return;
    setBusy(true);
    const norm = phone.replace(/\s/g, "");
    const { data, error } = await supabase.functions.invoke("phone-auth", {
      body: { action: "verify-otp", phone: norm, code: otp, linkToUserId: user.id },
    });
    setBusy(false);
    if (error || !data?.ok) return toast.error(data?.error || error?.message || "Invalid code");
    toast.success("Phone verified");
    await invalidateProfile();
    onComplete?.();
  };

  const saveEmailName = async () => {
    if (!user) return;
    const e = email.trim();
    const n = name.trim();
    if (missing === "email" && !/^\S+@\S+\.\S+$/.test(e)) return toast.error("Enter a valid email");
    if (missing === "name" && n.length < 2) return toast.error("Enter your name");
    setBusy(true);
    if (missing === "email") {
      const { data: exists } = await supabase.rpc("email_exists", { _email: e });
      if (exists) { setBusy(false); return toast.error("This email is already used"); }
    }
    const patch: { email?: string; full_name?: string } = {};
    if (missing === "email") patch.email = e;
    if (missing === "name") patch.full_name = n;
    try {
      await userService.updateProfile(user.id, patch);
    } catch (error: any) {
      setBusy(false);
      return toast.error(error.message);
    }
    setBusy(false);
    toast.success(missing === "email" ? "Email saved" : "Name saved");
    await invalidateProfile();
    onComplete?.();
  };

  const titleMap: Record<Exclude<Missing, null>, string> = {
    phone: "Verify your phone number",
    email: "Add your email",
    name: "What should we call you?",
  };
  const iconMap: Record<Exclude<Missing, null>, JSX.Element> = {
    phone: <Phone className="w-5 h-5 text-brown" />,
    email: <Mail className="w-5 h-5 text-brown" />,
    name: <UserIcon className="w-5 h-5 text-brown" />,
  };

  if (!missing) return null;

  const handleOpenChange = (next: boolean) => {
    if (blocking && !next) return;
    onOpenChange?.(next);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-w-lg mx-auto"
        onInteractOutside={(e) => { if (blocking) e.preventDefault(); }}
        onEscapeKeyDown={(e) => { if (blocking) e.preventDefault(); }}
      >
        <SheetHeader className="text-left">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 rounded-full gradient-yolk grid place-items-center">{iconMap[missing]}</div>
            <div>
              <SheetTitle className="font-display text-brown text-xl">{titleMap[missing]}</SheetTitle>
              <SheetDescription className="text-sm">
                {blocking ? "Required to place this order — won't take a moment." : "Add this so we can reach you about deliveries."}
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="pt-4 space-y-4">
          {missing === "phone" && (stage === "input" ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Phone number</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
              </div>
              <Button variant="hero" className="w-full" onClick={sendPhoneOtp} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send OTP
              </Button>
              <p className="text-xs text-muted-foreground flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5" /> Demo mode — code shown on screen.</p>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to <strong className="text-brown">{phone}</strong></p>
              <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                <InputOTPGroup>
                  {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                </InputOTPGroup>
              </InputOTP>
              <Button variant="hero" className="w-full" onClick={verifyPhoneAndLink} disabled={busy || otp.length !== 6}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify & save
              </Button>
              <button type="button" className="text-xs text-muted-foreground hover:text-brown" onClick={() => { setStage("input"); setOtp(""); }}>Change number</button>
            </div>
          ))}

          {(missing === "email" || missing === "name") && (
            <div className="space-y-3">
              {missing === "email" && (
                <div className="space-y-1.5">
                  <Label>Email</Label>
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" />
                </div>
              )}
              {missing === "name" && (
                <div className="space-y-1.5">
                  <Label>Full name</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" />
                </div>
              )}
              <Button variant="hero" className="w-full" onClick={saveEmailName} disabled={busy}>
                {busy && <Loader2 className="w-4 h-4 animate-spin" />} Save
              </Button>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default JitVerifySheet;