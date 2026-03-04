export const config = {
  api: { bodyParser: { sizeLimit: "256kb" } }
};

const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { tools, estimated, actual, breakdown, delta, team_size, industry, lead_id } = body || {};

  if (!tools || !estimated || !actual) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  // Calculate implied per-tool pricing from the override
  // Strategy: distribute the delta proportionally across unpriced or underpriced tools
  const toolCount = tools.length || 1;
  const perToolActual = actual / toolCount;

  // Build per-tool pricing signals from the breakdown
  // breakdown = { toolName: estimatedPrice, ... }
  const signals = [];

  if (breakdown && Object.keys(breakdown).length > 0) {
    const totalEstimated = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const scaleFactor = totalEstimated > 0 ? actual / totalEstimated : 1;

    Object.entries(breakdown).forEach(([tool, est_price]) => {
      // Scale each tool's estimated price by the same factor the user applied overall
      const implied_price = Math.round(est_price * scaleFactor);
      if (implied_price > 0 && implied_price < 50000) {
        signals.push({
          tool_name: tool,
          estimated_price: est_price,
          implied_price,
          team_size: team_size ? parseInt(team_size) : null,
          industry: industry || null,
          lead_id: lead_id || null,
          total_estimated: estimated,
          total_actual: actual,
          delta,
          scale_factor: Math.round(scaleFactor * 100) / 100
        });
      }
    });
  } else {
    // No breakdown — just record the total-level signal
    signals.push({
      tool_name: "_total",
      estimated_price: estimated,
      implied_price: actual,
      team_size: team_size ? parseInt(team_size) : null,
      industry: industry || null,
      lead_id: lead_id || null,
      total_estimated: estimated,
      total_actual: actual,
      delta,
      scale_factor: actual / estimated
    });
  }

  // Write all signals to Supabase
  const results = await Promise.allSettled(
    signals.map(signal =>
      fetch(`${SUPABASE_URL}/rest/v1/pricing_signals`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(signal)
      })
    )
  );

  const saved = results.filter(r => r.status === "fulfilled").length;
  return res.status(200).json({ success: true, signals_saved: saved });
}
