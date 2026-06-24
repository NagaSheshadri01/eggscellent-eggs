import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  envContent.split("\n").forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim().replace(/^['"]|['"]$/g, "");
    }
  });
}

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testRpc() {
  console.log("Testing with only _order_id and _status...");
  const { data, error } = await supabase.rpc("partner_update_status", {
    _order_id: "00000000-0000-0000-0000-000000000000",
    _status: "delivered"
  });
  
  if (error) {
    console.log("Error:", error.message);
  } else {
    console.log("Success! Data:", data);
  }

  console.log("\\nTesting with _order_id, _new_status...");
  const { data: d2, error: e2 } = await supabase.rpc("partner_update_status", {
    _order_id: "00000000-0000-0000-0000-000000000000",
    _new_status: "delivered"
  });
  if (e2) {
    console.log("Error:", e2.message);
  } else {
    console.log("Success! Data:", d2);
  }
}

testRpc();
