export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } }
};

const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const {
    lead_id, tools, tool_count, industry, monthly_spend, goals,
    stack_score, estimated_savings_monthly, estimated_savings_annual,
    overlaps_found, tools_flagged, top_recommendation
  } = body || {};

  if (!lead_id) return res.status(400).json({ error: "Missing lead_id" });

  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/leads?id=eq.${lead_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "return=minimal"
      },
      body: JSON.stringify({
        tools: tools || [],
        tool_count: tool_count || 0,
        industry: industry || null,
        monthly_spend: monthly_spend ? parseFloat(monthly_spend) : null,
        goals: goals || [],
        stack_score: stack_score || null,
        estimated_savings_monthly: estimated_savings_monthly || 0,
        estimated_savings_annual: estimated_savings_annual || 0,
        overlaps_found: overlaps_found || 0,
        tools_flagged: tools_flagged || null,
        top_recommendation: top_recommendation || null
      })
    });

    if (!resp.ok) {
      const err = await resp.text();
      console.error("Supabase report update error:", resp.status, err);
      return res.status(502).json({ error: "Database error" });
    }

    return res.status(200).json({ success: true });

  } catch(e) {
    console.error("Report handler error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
