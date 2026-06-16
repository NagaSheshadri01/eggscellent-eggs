import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_PUBLISHABLE_KEY);

async function run() {
  const payload = {
    user_id: '123e4567-e89b-12d3-a456-426614174000', // Dummy UUID
    address_tag: "Home",
    full_name: "Test User",
    phone: "1234567890",
    address_line_1: "Flat 1",
    city: "Hyderabad",
    state: "Telangana",
    pincode: "500001",
    lat: 17.5,
    lng: 78.5,
    email: "test@example.com" // This column might not exist!
  };

  console.log("Attempting insert...");
  const res = await supabase.from('addresses').insert(payload).select().single();
  console.log("Result:", JSON.stringify(res, null, 2));
}

run().catch(console.error);
