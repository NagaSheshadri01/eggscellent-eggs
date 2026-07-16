import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";
import Seo from "@/components/Seo";
import { Loader2, Phone } from "lucide-react";


const extractErrorMsg = async (error: any, data: any, defaultMsg: string) => {
  if (data?.error) return data.error;
  if (!error) return defaultMsg;
  if (error.context && typeof error.context.json === 'function') {
    try {
      const errData = await error.context.json();
      if (errData?.error) return errData.error;
    } catch (e) {}
  }
  return error.message || defaultMsg;
};
// Normalize input to E.164. Adds +91 default for 10-digit Indian mobiles.
const toE164 = (raw: string): string | null => {
  const cleaned = raw.replace(/[^\d+]/g, "");
  if (/^\+\d{10,15}$/.test(cleaned)) return cleaned;
  if (/^\d{10}$/.test(cleaned)) return `+91${cleaned}`;
  if (/^\d{11,15}$/.test(cleaned)) return `+${cleaned}`;
  return null;
};

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Auth = () => {
  const nav = useNavigate();
  const [params] = useSearchParams();
  const next = params.get("next") || "/";
  const { user, loading } = useAuth();

  const [busy, setBusy] = useState(false);
  const [phone, setPhone] = useState("");
  const [otpStage, setOtpStage] = useState<"phone" | "code">("phone");
  const [otp, setOtp] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [normalized, setNormalized] = useState("");

  useEffect(() => { if (!loading && user && !busy) nav(next, { replace: true }); }, [user, loading, busy, nav, next]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const sendCode = async () => {
    const norm = toE164(phone);
    if (!norm) {
      toast.error("Enter a valid phone number");
      return;
    }
    setNormalized(norm);
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("phone-auth", {
      body: { action: "send-otp", phone: norm },
    });
    setBusy(false);
    if (error || !data?.ok) {
      toast.error(await extractErrorMsg(error, data, "Could not send OTP"));
      return;
    }
    setOtpStage("code");
    setResendIn(30);
    toast.success(`OTP sent (demo code: ${data.devCode})`, { duration: 8000 });
  };

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("phone-auth", {
      body: { action: "verify-otp", phone: normalized, code: otp },
    });
    if (error || !data?.ok || !data.access_token) {
      toast.error(await extractErrorMsg(error, data, "Invalid or expired OTP"));
      setBusy(false);
      return;
    }
    const { error: sErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (sErr) { toast.error(sErr.message); setBusy(false); return; }
    // Refresh once, then wait briefly so profile/role writes are visible before redirect.
    try { await supabase.auth.refreshSession(); } catch {}
    await wait(500);
    toast.success("Signed in");
    setBusy(false);
  };

  return (
    <div className="min-h-screen bg-gradient-warm grid place-items-center px-4 py-10">
      <Seo title="Sign in — Eggscellent" description="Sign in with your phone number to track orders, manage subscriptions, and reorder farm-fresh eggs." />
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center gap-2 mb-8 justify-center">
          <div className="w-10 h-10 rounded-full gradient-yolk grid place-items-center shadow-yolk">
            <span className="text-brown font-display font-bold">e</span>
          </div>
          <span className="font-display font-bold text-brown text-xl">Eggscellent</span>
        </Link>

        <div className="bg-card rounded-3xl shadow-card p-6 sm:p-8 animate-scale-in">
          <h1 className="font-display font-bold text-brown text-2xl tracking-tight">Welcome to Eggscellent</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in with your phone — it's the same flow for new and returning customers.</p>

          <div className="mt-6">
            {otpStage === "phone" ? (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Phone number</Label>
                  <div className="relative">
                    <Phone className="w-4 h-4 absolute left-3 top-3.5 text-muted-foreground" />
                    <Input className="pl-9" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" inputMode="tel" />
                  </div>
                </div>
                <Button variant="hero" size="lg" className="w-full" onClick={sendCode} disabled={busy}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Send OTP
                </Button>
                <p className="text-xs text-muted-foreground">Demo mode — OTP is shown on screen, no SMS sent.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to <strong className="text-brown">{normalized}</strong></p>
                <InputOTP maxLength={6} value={otp} onChange={setOtp}>
                  <InputOTPGroup>
                    {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} />)}
                  </InputOTPGroup>
                </InputOTP>
                <Button variant="hero" size="lg" className="w-full" onClick={handleVerify} disabled={busy || otp.length !== 6}>
                  {busy && <Loader2 className="w-4 h-4 animate-spin" />} Verify & continue
                </Button>
                <div className="flex items-center justify-between text-sm">
                  <button className="text-muted-foreground hover:text-brown" onClick={() => { setOtpStage("phone"); setOtp(""); }}>Change number</button>
                  <button className="text-brown font-semibold disabled:opacity-50" disabled={resendIn > 0} onClick={sendCode}>
                    {resendIn > 0 ? `Resend in ${resendIn}s` : "Resend OTP"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By continuing you agree to our Terms & Privacy Policy.
        </p>
      </div>
    </div>
  );
};

export default Auth;
