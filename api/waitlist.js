const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { email, waitlist_type, source_page, context } = body || {};

  if (!email || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/waitlist`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        email,
        waitlist_type: waitlist_type || "general",
        source_page: source_page || null,
        company: context?.company || null,
        role: context?.role || null,
        lead_id: context?.lead_id || null,
        created_at: new Date().toISOString()
      })
    });

    const data = await resp.json();

    // Handle duplicate email gracefully — Supabase returns 409 on unique violation
    if (resp.status === 409) {
      return res.status(200).json({ success: true, duplicate: true });
    }

    if (!resp.ok) {
      console.error("Supabase waitlist insert error:", data);
      return res.status(502).json({ error: "Database error", detail: data });
    }

    return res.status(200).json({ success: true });

  } catch(e) {
    console.error("Waitlist handler error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
