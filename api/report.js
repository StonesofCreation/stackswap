const SUPABASE_URL = "https://sruapwyxvwehwfmafobh.supabase.co";

// ── Capability baselines by industry ──────────────────────────────────────────
const BASELINES = {
  "SaaS / Tech":       ["crm","sequencing","data_enrichment","automation","collaboration","scheduling","analytics"],
  "Real Estate":       ["crm","scheduling","automation","collaboration","document_signing","email_marketing"],
  "Marketing Agency":  ["crm","project_management","collaboration","automation","analytics","reporting"],
  "E-commerce":        ["email_marketing","analytics","automation","ticketing","sms_marketing"],
  "Finance / Fintech": ["crm","analytics","automation","collaboration","reporting","compliance"],
  "Healthcare":        ["crm","scheduling","collaboration","automation","compliance"],
  "Legal":             ["crm","document_signing","automation","collaboration","billing"],
  "_default":          ["crm","automation","collaboration","analytics"],
};

// ── Capability-aware replacement map ──────────────────────────────────────────
const REPLACEMENTS = {
  "ZoomInfo":      { r:"Apollo.io",  why:"Apollo covers data_enrichment + sequencing at ~85% lower cost",        save:2000 },
  "Outreach":      { r:"Smartlead",  why:"Smartlead covers sequencing + deliverability at $94/mo vs $130/seat",  save:650  },
  "Salesloft":     { r:"Apollo.io",  why:"Apollo covers sequencing + enrichment. Combined cost beats Salesloft", save:600  },
  "Marketo":       { r:"HubSpot",    why:"HubSpot covers marketing_automation + crm at 60% lower cost",          save:1200 },
  "Pardot":        { r:"HubSpot",    why:"HubSpot covers same capabilities at half the cost",                    save:1000 },
  "Gong":          { r:"Avoma",      why:"Avoma covers call_recording + coaching + transcription at $40/seat",   save:640  },
  "Chorus":        { r:"Avoma",      why:"Avoma matches all capabilities at 50% lower cost",                     save:360  },
  "Drift":         { r:"Intercom",   why:"Intercom covers chat + onboarding + automation at fraction of cost",   save:2000 },
  "Tableau":       { r:"Power BI",   why:"Power BI covers bi + reporting. Included in M365",                    save:300  },
  "Looker":        { r:"Metabase",   why:"Metabase covers analytics + reporting, open-source available",         save:2500 },
  "Hotjar":        { r:"PostHog",    why:"PostHog covers session_replay + analytics + feature_flags — free tier",save:99   },
  "FullStory":     { r:"PostHog",    why:"PostHog covers session_replay + product_analytics for less",           save:800  },
  "Confluence":    { r:"Notion",     why:"Notion covers documentation + knowledge_base with better UX",          save:60   },
  "Jasper":        { r:"Claude",     why:"Direct LLM access covers same content generation at $20/mo",           save:80   },
  "Hootsuite":     { r:"Buffer",     why:"Buffer covers social scheduling at $18/mo vs $249/mo",                 save:231  },
  "Sprout Social": { r:"Buffer",     why:"Buffer covers scheduling + analytics at fraction of cost",             save:230  },
  "Workato":       { r:"Make",       why:"Make covers automation + api_integration at $16/mo vs $1500/mo",       save:1484 },
  "Tray.io":       { r:"n8n",        why:"n8n covers automation + api_integration, self-hosted option",          save:980  },
};

const CAP_SUGGESTIONS = {
  crm:"HubSpot", sequencing:"Apollo.io", data_enrichment:"Apollo.io",
  automation:"Make", collaboration:"Slack", scheduling:"Calendly",
  analytics:"PostHog", project_management:"Linear", documentation:"Notion",
  knowledge_base:"Notion", email_marketing:"Mailchimp", ticketing:"Help Scout",
  call_recording:"Avoma", document_signing:"PandaDoc", bi:"Metabase",
  session_replay:"PostHog",
};

module.exports = async function handler(req, res) {
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

  const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
  if (!SUPABASE_KEY) return res.status(500).json({ error: "SUPABASE_ANON_KEY not set" });

  const supaHeaders = {
    "Content-Type": "application/json",
    "apikey": SUPABASE_KEY,
    "Authorization": `Bearer ${SUPABASE_KEY}`,
  };

  try {
    const toolList = Array.isArray(tools) ? tools : [];
    let capCoverage = {}, toolCaps = {};

    // ── 1. Fetch capabilities from Supabase ───────────────────────────────────
    if (toolList.length > 0) {
      const nameFilter = toolList.map(t => `tool_name=eq.${encodeURIComponent(t)}`).join("&");
      const capResp = await fetch(
        `${SUPABASE_URL}/rest/v1/tool_capabilities?select=tool_name,capability,weight&${nameFilter}&limit=500`,
        { headers: supaHeaders }
      );
      if (capResp.ok) {
        const rows = await capResp.json();
        rows.forEach(({ tool_name, capability }) => {
          if (!capCoverage[capability]) capCoverage[capability] = [];
          if (!capCoverage[capability].includes(tool_name)) capCoverage[capability].push(tool_name);
          if (!toolCaps[tool_name]) toolCaps[tool_name] = [];
          toolCaps[tool_name].push(capability);
        });
      }
    }

    // ── 2. Redundancy: capability covered by 2+ tools ─────────────────────────
    const redundancies = Object.entries(capCoverage)
      .filter(([, t]) => t.length > 1)
      .map(([cap, t]) => ({ capability: cap, tools: t }));

    // ── 3. Missing capabilities vs baseline ───────────────────────────────────
    const baseline = BASELINES[industry] || BASELINES["_default"];
    const coveredCaps = new Set(Object.keys(capCoverage));
    const missingCaps = baseline.filter(cap => !coveredCaps.has(cap));

    // ── 4. Safe removal: only flag if all caps are covered elsewhere ──────────
    const safeToRemove = toolList.filter(tool => {
      const caps = toolCaps[tool] || [];
      if (caps.length === 0) return false;
      return caps.every(cap =>
        (capCoverage[cap] || []).filter(t => t !== tool).length > 0
      );
    });

    // ── 5. Build recommendations ──────────────────────────────────────────────
    const capRecs = [];
    redundancies.forEach(({ capability, tools: covTools }) => {
      covTools.forEach(tool => {
        const rep = REPLACEMENTS[tool];
        if (rep && !capRecs.find(r => r.remove === tool)) {
          capRecs.push({ type:"redundancy", remove:tool, keep:rep.r, capability, why:rep.why, save:rep.save });
        }
      });
    });
    missingCaps.forEach(cap => {
      const suggest = CAP_SUGGESTIONS[cap];
      if (suggest && !toolList.includes(suggest)) {
        capRecs.push({ type:"gap", capability:cap, suggest });
      }
    });

    // ── 6. Write to Supabase ──────────────────────────────────────────────────
    const reportPayload = {
      lead_id: lead_id || null,
      tools: toolList,
      tool_count: tool_count || toolList.length,
      industry: industry || null,
      monthly_spend: monthly_spend ? parseFloat(monthly_spend) : null,
      goals: goals || [],
      stack_score: stack_score || null,
      estimated_savings_monthly: estimated_savings_monthly || 0,
      estimated_savings_annual: estimated_savings_annual || 0,
      overlaps_found: overlaps_found || redundancies.length,
      tools_flagged: tools_flagged || (safeToRemove.length ? safeToRemove.join(", ") : null),
      top_recommendation: top_recommendation || capRecs.find(r=>r.type==="redundancy")?.remove || capRecs.find(r=>r.type==="gap")?.suggest || null,
    };

    // Add capability columns only if they exist in schema (graceful degradation)
    try {
      reportPayload.capability_coverage  = Object.keys(capCoverage);
      reportPayload.missing_capabilities = missingCaps;
      reportPayload.redundant_capabilities = redundancies.map(r => r.capability);
    } catch(_) {}

    const resp = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
      method: "POST",
      headers: { ...supaHeaders, "Prefer": "return=minimal" },
      body: JSON.stringify(reportPayload)
    });

    if (!resp.ok) {
      const err = await resp.text();
      // If capability columns don't exist yet, retry without them
      if (err.includes("capability")) {
        delete reportPayload.capability_coverage;
        delete reportPayload.missing_capabilities;
        delete reportPayload.redundant_capabilities;
        const retry = await fetch(`${SUPABASE_URL}/rest/v1/reports`, {
          method: "POST",
          headers: { ...supaHeaders, "Prefer": "return=minimal" },
          body: JSON.stringify(reportPayload)
        });
        if (!retry.ok) {
          const retryErr = await retry.text();
          console.error("Report insert retry error:", retry.status, retryErr);
          return res.status(502).json({ error: "Database error", detail: retryErr });
        }
      } else {
        console.error("Supabase report insert error:", resp.status, err);
        return res.status(502).json({ error: "Database error", detail: err });
      }
    }

    return res.status(200).json({
      success: true,
      capability_analysis: { coverage: capCoverage, redundancies, missing: missingCaps, safe_to_remove: safeToRemove, recommendations: capRecs }
    });

  } catch(e) {
    console.error("Report handler error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
