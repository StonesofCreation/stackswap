const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { tool_name, source } = body || {};

  if (!tool_name || tool_name.trim().length < 2) {
    return res.status(400).json({ error: "tool_name required" });
  }

  // Basic sanity check — reject obvious junk
  const name = tool_name.trim();
  if (name.length > 80 || /[<>{}]/.test(name)) {
    return res.status(400).json({ error: "Invalid tool name" });
  }

  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/tools`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`,
        "Prefer": "resolution=ignore-duplicates,return=minimal"
      },
      body: JSON.stringify({
        tool_name: name,
        source: source || "user_input",
        submission_count: 1
      })
    });

    // 409 = duplicate, that's fine
    if (!resp.ok && resp.status !== 409) {
      const err = await resp.text();
      // If table doesn't exist yet, silently fail — don't block the user
      console.warn("Tools table insert failed:", resp.status, err);
    }

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error("Tools handler error:", e.message);
    return res.status(200).json({ success: true }); // Silent fail — never block the user
  }
}
