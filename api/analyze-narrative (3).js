export const config = {
  api: { bodyParser: { sizeLimit: "1mb" } }
};

export default async function handler(req, res) {
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

  if (!prompt || typeof prompt !== "string" || prompt.length < 5) {
    return res.status(400).json({ error: "Missing prompt" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not set" });

  // Truncate prompt to avoid token limits on the proxy side
  const truncated = prompt.slice(0, 4000);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 700,
        messages: [{ role: "user", content: truncated }]
      })
    });

    const rawText = await response.text();

    if (!response.ok) {
      console.error("Anthropic error:", response.status, rawText);
      // Return the actual Anthropic error so we can see it
      return res.status(502).json({ 
        error: "Anthropic API error", 
        status: response.status,
        detail: rawText.slice(0, 500)
      });
    }

    let data;
    try { data = JSON.parse(rawText); } 
    catch(e) { return res.status(500).json({ error: "Bad JSON from Anthropic", raw: rawText.slice(0,200) }); }

    const text = data.content?.[0]?.text || "";
    const clean = text.replace(/```json\s*|```\s*/g, "").trim();

    let parsed;
    try { parsed = JSON.parse(clean); }
    catch(e) {
      console.error("JSON parse failed:", text);
      return res.status(500).json({ error: "Could not parse AI response", raw: text.slice(0,200) });
    }

    return res.status(200).json(parsed);

  } catch(e) {
    console.error("Handler error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
