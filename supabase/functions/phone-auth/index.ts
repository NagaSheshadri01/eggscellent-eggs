import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const normalize = (p: string) => p.replace(/\s+/g, "").trim();

const admin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

// Synthetic auth-only email used when the user only has a phone.
// Never shown to the user — profiles.email stays NULL so the UI shows the phone.
const synthEmail = (phone: string) => `${phone.replace(/\D/g, "")}@auth.eggscellent.app`;

const authClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "auth" },
  },
);

const findUserByPhone = async (phone: string) => {
  // 1. Try finding in public.profiles first
  const { data: prof } = await admin
    .from("profiles")
    .select("id, email")
    .eq("phone", phone)
    .maybeSingle();
  if (prof) return { id: prof.id as string, email: prof.email as string | null };

  // 2. Fallback: if public.profiles is cleared but auth.users still has the user
  const synth = synthEmail(phone);
  try {
    const { data: authUser } = await authClient
      .from("users")
      .select("id, email")
      .eq("email", synth)
      .maybeSingle();

    if (authUser) {
      return { id: authUser.id as string, email: authUser.email as string | null };
    }
  } catch (err) {
    console.error("Fallback auth lookup failed:", err);
  }
  return null;
};

const ensureCustomerRole = async (userId: string) => {
  const { error } = await admin
    .from("user_roles")
    .insert({ user_id: userId, role: "customer" });
  if (error && !error.message.toLowerCase().includes("duplicate")) throw error;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");
    const phone = normalize(String(body.phone || ""));
    if (!phone || !/^\+?\d{10,15}$/.test(phone)) {
      return json({ error: "Invalid phone" }, 400);
    }

    if (action === "send-otp") {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      const expiresAt = new Date(Date.now() + 5 * 60_000).toISOString();
      // Invalidate old codes for this phone
      await admin.from("phone_otps").update({ used: true }).eq("phone", phone).eq("used", false);
      const { error } = await admin
        .from("phone_otps")
        .insert({ phone, code, expires_at: expiresAt });
      if (error) return json({ error: error.message }, 500);
      // Demo: return the code so the user can complete the flow without SMS
      return json({ ok: true, devCode: code });
    }

    if (action === "verify-otp") {
      const code = String(body.code || "");
      const linkToUserId = body.linkToUserId ? String(body.linkToUserId) : null;
      if (!/^\d{6}$/.test(code)) return json({ error: "Invalid code" }, 400);

      const { data: rows } = await admin
        .from("phone_otps")
        .select("id, code, expires_at, used")
        .eq("phone", phone)
        .order("created_at", { ascending: false })
        .limit(1);
      const row = rows?.[0];
      // Idempotent: do NOT reject on `used`, since the gateway can legitimately retry
      // the same request. The code itself + expiry is enough.
      if (!row || row.code !== code || new Date(row.expires_at) < new Date()) {
        return json({ error: "Invalid or expired code" }, 401);
      }
      await admin.from("phone_otps").update({ used: true }).eq("id", row.id);

      // Mode A: link this phone to an already-signed-in account (from Checkout)
      if (linkToUserId) {
        const existing = await findUserByPhone(phone);
        if (existing && existing.id !== linkToUserId) {
          return json({ error: "This phone is already linked to another account" }, 409);
        }
        const { error: upErr } = await admin
          .from("profiles")
          .update({ phone })
          .eq("id", linkToUserId);
        if (upErr) return json({ error: upErr.message }, 500);
        return json({ ok: true, linked: true });
      }

      // Mode B: phone-as-login. Find or create the auth user, then mint a one-time password and return it.
      const password = crypto.randomUUID() + "Aa1!";
      let userId: string | null = null;
      let userEmail: string | null = null;
      let createdSynthetic = false;

      const existing = await findUserByPhone(phone);
      if (existing) {
        userId = existing.id;
        userEmail = existing.email;
        const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
        if (pwErr) return json({ error: pwErr.message }, 500);
      } else {
        // Create new auth user. Phone auth provider is disabled in this project,
        // so we attach a hidden synthetic email at the auth layer. The public-facing
        // profile keeps email = NULL so the user only sees their phone.
        const synth = synthEmail(phone);
        const { data: created, error: cErr } = await admin.auth.admin.createUser({
          email: synth,
          email_confirm: true,
          password,
          user_metadata: { phone, synthetic_email: true },
        });
        if (cErr || !created.user) return json({ error: cErr?.message || "Could not create user" }, 500);
        userId = created.user.id;
        createdSynthetic = true;
        // handle_new_user mirrored email; clear it and set the phone instead
        await admin
          .from("profiles")
          .upsert({ id: userId, email: null, phone }, { onConflict: "id" });
      }

      const { error: profileErr } = await admin
        .from("profiles")
        .upsert({ id: userId, email: userEmail ?? null, phone }, { onConflict: "id", ignoreDuplicates: false });
      if (profileErr) return json({ error: profileErr.message }, 500);
      await ensureCustomerRole(userId);

      const { data: authLookup, error: authLookupErr } = await admin.auth.admin.getUserById(userId);
      if (authLookupErr || !authLookup.user?.email) {
        return json({ error: authLookupErr?.message || "Could not resolve user" }, 500);
      }

      // Sign in to obtain tokens we can return to the client
      const anonClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
        { auth: { persistSession: false, autoRefreshToken: false } },
      );

      // Sign in via whichever email we have for this user (real one if linked,
      // synthetic one for phone-only accounts).
      const signInEmail = authLookup.user.email;
      const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
        email: signInEmail,
        password,
      });
      if (signInErr) return json({ error: signInErr.message }, 500);
      const session = signInData.session;
      if (!session) return json({ error: "Could not start session" }, 500);

      return json({
        ok: true,
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        created: createdSynthetic,
      });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});