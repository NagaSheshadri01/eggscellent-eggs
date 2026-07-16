# Edge Function Confession Report: `phone-auth`

Following a complete database and Edge Function code audit, here is the exact execution flow for a NEW user signing up and the potential vectors for a non-2xx status code crash. 

### 1. Database Insertions & Trigger Flow (Postgres)
When a new user signs up, the Edge Function calls `admin.auth.admin.createUser`, which internally triggers the `handle_new_user` Postgres trigger.
- **The Flow:**
  - `createUser` executes (inserts into `auth.users`).
  - `handle_new_user` fires synchronously, inserting a row into `public.profiles`.
  - `handle_new_user` inserts a row into `public.user_roles`.
  - The Edge Function resumes and calls `upsert` on `public.profiles` to clear the `email` column and explicitly set the `phone`.
- **Architectural Check:**
  - `public.profiles` schema: `id` (NOT NULL), `created_at` (NOT NULL, defaults to `now()`), `updated_at` (NOT NULL, defaults to `now()`). `full_name`, `email`, `phone`, `avatar_url`, and `is_vip` are all nullable. 
  - **Verdict:** There are **NO missing required columns** causing a Postgres error. The Postgres schema is fully compatible with the trigger logic.

### 2. External API Calls & Environment Variables
- **The Flow:**
  - The `send-otp` action generates a random 6-digit code and inserts it into `public.phone_otps`.
  - It explicitly comments out Twilio/SMS functionality (`// Demo: return the code so the user can complete the flow without SMS`) and returns the `devCode` directly to the client.
- **Architectural Check:**
  - There are NO Twilio environment variables required because the external SMS provider is completely mocked in the current implementation.
  - However, the Edge Function relies on `Deno.env.get("SUPABASE_URL")` and `Deno.env.get("SUPABASE_ANON_KEY")` (or `PUBLISHABLE_KEY`) to initialize the Supabase clients. 
  - **Verdict:** If these standard Supabase environment variables are missing from the local Edge Function environment (because Docker is not running or the secrets were not linked), `createClient` will throw an error immediately, causing a 500 crash.

### 3. Supabase Auth User Creation Handling
- **The Flow:**
  - Because native Phone Auth is disabled, the function generates a synthetic email (`[digits]@auth.eggscellent.app`).
  - It passes `email_confirm: true` to bypass email verification requirements.
  - It generates a highly secure random password (`crypto.randomUUID() + "Aa1!"`).
  - After creation, it uses `anonClient.auth.signInWithPassword` to mint an access token.
- **Architectural Check:**
  - **The Real "Crash" Flaw:** If the user enters an invalid OTP code, or an invalid phone number, the Edge Function explicitly returns a `400` or `401` status code with a JSON error payload (e.g., `{"error": "Invalid or expired code"}`). 
  - **The UI Trap:** Prior to the UI patch, the `@supabase/supabase-js` client intercepted *any* non-2xx status code and threw a generic `FunctionsHttpError: Edge Function returned a non-2xx status code`, completely obscuring the legitimate business-logic validation errors occurring during initialization.

### Summary
The backend architecture is structurally sound for new user creation (verified by direct remote invocation). The "crash" experienced by the user was definitively the UI failing to unwrap 400/401 validation payloads, masquerading expected rejections as generic 500-level Edge Function failures.
