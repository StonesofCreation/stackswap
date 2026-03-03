const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_ANON_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  try {
    // Fetch all reports - select only the fields we need for aggregation
    const resp = await fetch(
      `${SUPABASE_URL}/rest/v1/reports?select=industry,monthly_spend,estimated_savings_monthly,tools_flagged,top_recommendation,tool_count&limit=1000`,
      {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    if (!resp.ok) {
      const err = await resp.text();
      return res.status(502).json({ error: "Supabase error", detail: err });
    }

    const reports = await resp.json();
    const count = reports.length;

    if (count === 0) {
      return res.status(200).json({ count: 0, totalSavings: 0, cuts: {}, recs: {}, byIndustry: {} });
    }

    // Aggregate savings
    const totalSavings = reports.reduce((sum, r) => sum + (r.estimated_savings_monthly || 0), 0);

    // Aggregate tools flagged (tools_flagged is a string like "ZoomInfo, Drift, Marketo")
    const cutCounts = {};
    reports.forEach(r => {
      if (r.tools_flagged) {
        r.tools_flagged.split(",").map(t => t.trim()).filter(Boolean).forEach(tool => {
          cutCounts[tool] = (cutCounts[tool] || 0) + 1;
        });
      }
    });

    // Aggregate top recommendations
    const recCounts = {};
    reports.forEach(r => {
      if (r.top_recommendation) {
        const rec = r.top_recommendation.trim();
        if (rec) recCounts[rec] = (recCounts[rec] || 0) + 1;
      }
    });

    // Aggregate by industry
    const byIndustry = {};
    reports.forEach(r => {
      const ind = r.industry || "Other";
      if (!byIndustry[ind]) byIndustry[ind] = { count: 0, savings: 0, cuts: [] };
      byIndustry[ind].count++;
      byIndustry[ind].savings += r.estimated_savings_monthly || 0;
      if (r.tools_flagged) {
        r.tools_flagged.split(",").map(t => t.trim()).filter(Boolean).forEach(t => {
          byIndustry[ind].cuts.push(t);
        });
      }
    });

    // Sort cuts and recs by frequency, return top 10
    const sortedCuts = Object.entries(cutCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const sortedRecs = Object.entries(recCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    return res.status(200).json({
      count,
      totalSavings: Math.round(totalSavings),
      cuts: sortedCuts,
      recs: sortedRecs,
      byIndustry
    });

  } catch (e) {
    console.error("Metrics error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
