export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } }
};

const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { email, company, role, team_size, industry } = body || {};

  if (!email || !company || !role || !team_size) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=representation"
      },
      body: JSON.stringify({
        email,
        company,
        role,
        team_size,
        industry: industry || null,
        source_page: "analyze",
        created_at: new Date().toISOString()
      })
    });

    const data = await resp.json();
    if (!resp.ok) {
      console.error("Supabase lead insert error:", data);
      return res.status(502).json({ error: "Database error", detail: data });
    }

    const lead_id = Array.isArray(data) ? data[0]?.id : data?.id;
    return res.status(200).json({ success: true, lead_id });

  } catch(e) {
    console.error("Lead handler error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
