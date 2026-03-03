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
    const { email, company, role, team_size, industry } = req.body || {};

    if (!email || !company) {
      return res.status(400).json({ error: "Missing email or company" });
    }

    const clean = {
      email: String(email).trim().toLowerCase(),
      company: String(company).trim(),
      role: role ? String(role).trim() : null,
      team_size: team_size ? String(team_size).trim() : null,
      industry: industry ? String(industry).trim() : null
    };

    const { data, error } = await supabase
      .from("leads")
      .insert([clean])
      .select("id")
      .single();

    if (error) return res.status(500).json({ error: error.message });

    return res.status(200).json({ lead_id: data.id });
  } catch (e) {
    return res.status(500).json({ error: e?.message || "Unknown error" });
  }
}
