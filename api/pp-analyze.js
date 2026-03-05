// api/pp-analyze.js
// RE Back-Office Analyzer — Vercel serverless function
// Proxies to Anthropic API with broker-specific prompt handling

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  let prompt;
  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    prompt = body?.prompt;
  } catch(e) {
    return res.status(400).json({ error: "Could not parse request body" });
  }

  if (!prompt || typeof prompt !== "string" || prompt.length < 10) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt.slice(0, 8000) }]
      })
    });

    const rawText = await response.text();
    if (!response.ok) {
      console.error("Anthropic error:", response.status, rawText);
      return res.status(502).json({ error: "Anthropic API error", status: response.status });
    }

    const data = JSON.parse(rawText);
    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json\s*|```\s*/g, "").trim();

    // Extract JSON even if there's surrounding text
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: "No JSON in response" });

    const parsed = JSON.parse(jsonMatch[0]);
    return res.status(200).json(parsed);

  } catch(e) {
    console.error("pp-analyze error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
