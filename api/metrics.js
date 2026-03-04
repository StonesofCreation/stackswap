const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_ANON_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  const headers = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Content-Type": "application/json"
  };

  try {
    const [reportsResp, pricingResp] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/reports?select=industry,monthly_spend,estimated_savings_monthly,tools_flagged,top_recommendation,tool_count&limit=1000`, { headers }),
      fetch(`${SUPABASE_URL}/rest/v1/pricing_signals?select=tool_name,implied_price,team_size,industry&limit=2000`, { headers })
    ]);

    if (!reportsResp.ok) {
      const err = await reportsResp.text();
      return res.status(502).json({ error: "Supabase error", detail: err });
    }

    const reports = await reportsResp.json();
    const count = reports.length;

    if (count === 0) {
      return res.status(200).json({ count: 0, totalSavings: 0, cuts: [], recs: [], byIndustry: {}, pricing: {} });
    }

    // Savings
    const totalSavings = reports.reduce((sum, r) => sum + (r.estimated_savings_monthly || 0), 0);

    // Tool exit counts
    const cutCounts = {};
    reports.forEach(r => {
      if (r.tools_flagged) {
        r.tools_flagged.split(",").map(t => t.trim()).filter(Boolean).forEach(tool => {
          cutCounts[tool] = (cutCounts[tool] || 0) + 1;
        });
      }
    });

    // Recommendation counts
    const recCounts = {};
    reports.forEach(r => {
      if (r.top_recommendation) {
        const rec = r.top_recommendation.trim();
        if (rec) recCounts[rec] = (recCounts[rec] || 0) + 1;
      }
    });

    // By industry
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

    // Pricing signals aggregation
    const pricingByTool = {};
    if (pricingResp.ok) {
      const signals = await pricingResp.json();
      signals.forEach(s => {
        if (!s.tool_name || s.tool_name === "_total") return;
        if (!s.implied_price || s.implied_price < 1 || s.implied_price > 50000) return;
        const key = s.tool_name.toLowerCase();
        if (!pricingByTool[key]) pricingByTool[key] = { tool_name: s.tool_name, prices: [], by_team_size: {} };
        pricingByTool[key].prices.push(s.implied_price);
        if (s.team_size) {
          const bucket = s.team_size <= 5 ? "1-5" : s.team_size <= 20 ? "6-20" : s.team_size <= 50 ? "21-50" : "50+";
          if (!pricingByTool[key].by_team_size[bucket]) pricingByTool[key].by_team_size[bucket] = [];
          pricingByTool[key].by_team_size[bucket].push(s.implied_price);
        }
      });
    }

    // Compute medians, remove outliers
    const pricing = {};
    Object.entries(pricingByTool).forEach(([key, data]) => {
      if (data.prices.length < 2) return;
      const sorted = [...data.prices].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const filtered = sorted.filter(p => p >= median / 3 && p <= median * 3);
      if (filtered.length < 2) return;
      const cleanMedian = filtered[Math.floor(filtered.length / 2)];
      const byTeamSize = {};
      Object.entries(data.by_team_size).forEach(([bucket, prices]) => {
        if (prices.length < 2) return;
        const ts = [...prices].sort((a, b) => a - b);
        byTeamSize[bucket] = ts[Math.floor(ts.length / 2)];
      });
      pricing[data.tool_name] = {
        median: cleanMedian,
        mean: Math.round(filtered.reduce((s, v) => s + v, 0) / filtered.length),
        min: filtered[0],
        max: filtered[filtered.length - 1],
        sample_count: filtered.length,
        by_team_size: byTeamSize
      };
    });

    const sortedCuts = Object.entries(cutCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
    const sortedRecs = Object.entries(recCounts).sort((a, b) => b[1] - a[1]).slice(0, 10);

    return res.status(200).json({ count, totalSavings: Math.round(totalSavings), cuts: sortedCuts, recs: sortedRecs, byIndustry, pricing });

  } catch (e) {
    console.error("Metrics error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
