async function testPhoneAuth() {
  const url = "https://tdnqhyzccuspszbnvjtz.supabase.co/functions/v1/phone-auth";
  const anonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRkbnFoeXpjY3VzcHN6Ym52anR6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg2NjEzOTEsImV4cCI6MjA5NDIzNzM5MX0.kB8UZAN0sgmQC2lQk6m9Vu_RRA27WeuzuzRd_Oowt8A";
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${anonKey}`
  };

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        action: 'send-otp',
        phone: '+15551234567' // 11 digits, standard US length
      })
    });
    const text = await res.text();
    console.log("Send OTP Status:", res.status);
    console.log("Send OTP Response:", text);
    
    if (res.status === 200) {
      const data = JSON.parse(text);
      if (data.devCode) {
        const verifyRes = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            action: 'verify-otp',
            phone: '+15551234567',
            code: data.devCode
          })
        });
        const verifyText = await verifyRes.text();
        console.log("Verify Status:", verifyRes.status);
        console.log("Verify Response:", verifyText);
      }
    }
  } catch (err) {
    console.error("Fetch error:", err);
  }
}

testPhoneAuth();
