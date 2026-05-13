// Mocked OTP flow — replace with real provider (Supabase phone auth, Twilio, etc.) later.
// Single source of truth so plugging in production OTP is one file.

const STORE_KEY = "mock_otp_store";

type Store = Record<string, { code: string; expiresAt: number }>;

const read = (): Store => {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || "{}"); } catch { return {}; }
};
const write = (s: Store) => sessionStorage.setItem(STORE_KEY, JSON.stringify(s));

export const sendOtp = async (phone: string): Promise<{ ok: true; devCode: string }> => {
  await new Promise(r => setTimeout(r, 600));
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const s = read();
  s[phone] = { code, expiresAt: Date.now() + 5 * 60_000 };
  write(s);
  // For demo: surface the code so reviewers can complete the flow.
  // In production this would be sent via SMS.
  console.info(`[Mock OTP] ${phone} → ${code}`);
  return { ok: true, devCode: code };
};

export const verifyOtp = async (phone: string, code: string): Promise<boolean> => {
  await new Promise(r => setTimeout(r, 400));
  const s = read();
  const entry = s[phone];
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) return false;
  return entry.code === code;
};
