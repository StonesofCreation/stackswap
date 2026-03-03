import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const {
      lead_id,
      tools,
      tool_count,
      stack_score,
      estimated_savings_monthly,
      estimated_savings_annual,
      overlaps_found,
      tools_flagged,
      top_recommendation,
      report_summary
    } = req.body || {};

    if (!lead_id) return res.status(400).json({ error: "Missing lead_id" });
    if (!Array.isArray(tools) || tools.length < 1) {
      return res.status(400).json({ error: "Missing tools array" });
    }
    if (typeof stack_score !== "number") {
      return res.status(400).json({ error: "Missing stack_score (number)" });
    }

    const row = {
      lead_id,
      tools,
      tool_count: typeof tool_count === "number" ? tool_count : tools.length,
      stack_score,
      estimated_savings_monthly: Number(estimated_savings_monthly || 0),
      estimated_savings_annual: Number(estimated_savings_annual || 0),
      overlaps_found: Number(overlaps_found || 0),
      tools_flagged: Array.isArray(tools_flagged) ? tools_flagged : [],
      top_recommendation: top_recommendation ? String(top_recommendation) : null,
      report_summary: report_summary ? String(report_summary) : null
    };

    const { data, error } = await supabase
      .from("stack_reports")
      .insert([row])
      .select("id")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ report_id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
