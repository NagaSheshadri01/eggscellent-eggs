import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CreditCard } from "lucide-react";
import { payNow, type RzpResult } from "@/lib/payments/razorpay";

type Props = {
  amount: number;
  disabled?: boolean;
  onPaid: (r: Extract<RzpResult, { ok: true }>) => void;
  onFailed?: (msg: string) => void;
};

const RazorpayButton = ({ amount, disabled, onPaid, onFailed }: Props) => {
  const [busy, setBusy] = useState(false);
  const handle = async () => {
    setBusy(true);
    const res = await payNow(amount);
    setBusy(false);
    if (res.ok) onPaid(res);
    else onFailed?.((res as { ok: false; error: string }).error);
  };
  return (
    <Button variant="hero" size="lg" className="w-full" onClick={handle} disabled={busy || disabled}>
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
      {busy ? "Processing payment…" : `Pay ₹${amount} (demo)`}
    </Button>
  );
};

export default RazorpayButton;