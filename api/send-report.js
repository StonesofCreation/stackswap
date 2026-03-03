export const config = {
  api: { bodyParser: { sizeLimit: "2mb" } }
};


function buildReportHTML(data) {
  const {
    company, email, role, teamSize, industry,
    score, totalSave, tools,
    overlaps, upgrades, wrongTools, actions, optimized,
    aiNarrative, aiBiggestWin, aiSpendAssessment
  } = data;

  const scoreColor = score >= 70 ? "#4ecdc4" : score >= 50 ? "#ffc857" : "#ff6b6b";
  const scoreLabel = score >= 70 ? "Healthy Stack" : score >= 50 ? "Needs Attention" : "Needs Work";
  const annualSave = (totalSave * 12).toLocaleString();
  const monthlySave = totalSave.toLocaleString();

  const overlapRows = (overlaps || []).slice(0, 4).map(o =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #1e1d24;color:#c8c4bc;font-size:13px;">Cut <span style="color:#ff6b6b;">${o.b}</span> → Keep <span style="color:#4ecdc4;">${o.a}</span></td><td style="padding:8px 12px;border-bottom:1px solid #1e1d24;color:#ffc857;font-size:13px;text-align:right;white-space:nowrap;">$${o.save}/mo</td></tr>`
  ).join("");

  const upgradeRows = (upgrades || []).slice(0, 3).map(u =>
    `<tr><td style="padding:8px 12px;border-bottom:1px solid #1e1d24;color:#c8c4bc;font-size:13px;">Replace <span style="color:#ff6b6b;">${u.tool}</span> → <span style="color:#4ecdc4;">${u.r}</span></td><td style="padding:8px 12px;border-bottom:1px solid #1e1d24;color:#ffc857;font-size:13px;text-align:right;white-space:nowrap;">$${u.save}/mo</td></tr>`
  ).join("");

  const wrongRows = (wrongTools || []).slice(0, 2).map(w =>
    `<tr><td colspan="2" style="padding:8px 12px;border-bottom:1px solid #1e1d24;color:#ff6b6b;font-size:13px;">⚠️ ${w}</td></tr>`
  ).join("");

  const actionItems = (actions || []).slice(0, 3).map((a, i) =>
    `<div style="display:flex;gap:14px;margin-bottom:16px;">
      <div style="min-width:24px;height:24px;border-radius:50%;background:#ffc857;color:#0f0e13;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${i+1}</div>
      <div>
        <div style="color:#f0ece4;font-size:13px;font-weight:600;margin-bottom:3px;">${a.title}</div>
        <div style="color:#9a9690;font-size:12px;line-height:1.6;">${a.text}</div>
      </div>
    </div>`
  ).join("");

  const toolTags = (optimized || []).map(t =>
    `<span style="display:inline-block;background:rgba(78,205,196,0.1);border:1px solid rgba(78,205,196,0.25);color:#4ecdc4;border-radius:5px;padding:3px 10px;font-size:12px;margin:3px;">${t}</span>`
  ).join("");

  const aiSection = aiNarrative ? `
    <div style="background:rgba(255,200,87,0.04);border:1px solid rgba(255,200,87,0.15);border-radius:10px;padding:20px;margin-bottom:24px;">
      <div style="font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:#ffc857;margin-bottom:10px;font-weight:600;">AI Analysis</div>
      <p style="color:#c8c4bc;font-size:14px;line-height:1.75;margin:0 0 12px;">${aiNarrative}</p>
      ${aiBiggestWin ? `<div style="background:rgba(78,205,196,0.06);border-radius:6px;padding:10px 14px;font-size:13px;color:#9a9690;"><span style="color:#ffc857;font-weight:600;">⚡ Biggest win: </span>${aiBiggestWin}</div>` : ""}
      ${aiSpendAssessment ? `<div style="margin-top:10px;font-size:12px;color:#9a9690;border-top:1px solid rgba(255,255,255,0.05);padding-top:10px;">${aiSpendAssessment}</div>` : ""}
    </div>` : "";

  const contextLine = [industry, teamSize ? `${teamSize} team` : null].filter(Boolean).join(" · ");

  return `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#0f0e13;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:32px 16px;">

  <!-- Header -->
  <div style="text-align:center;margin-bottom:32px;">
    <div style="font-size:22px;font-weight:800;color:#f0ece4;letter-spacing:-.01em;margin-bottom:4px;">Stack<span style="color:#ffc857;">Swap</span></div>
    <div style="font-size:11px;color:#9a9690;letter-spacing:.12em;text-transform:uppercase;">StackScan Report · ${company}</div>
    ${contextLine ? `<div style="font-size:11px;color:#3a3830;margin-top:4px;">${contextLine}</div>` : ""}
  </div>

  <!-- Score Card -->
  <div style="background:#16151c;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:28px;margin-bottom:20px;text-align:center;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a9690;margin-bottom:12px;">Stack Health Score</div>
    <div style="font-size:72px;font-weight:700;color:${scoreColor};line-height:1;margin-bottom:8px;font-family:'Courier New',monospace;">${score}</div>
    <div style="font-size:16px;font-weight:600;color:${scoreColor};margin-bottom:8px;">${scoreLabel}</div>
    ${totalSave > 0 ? `
    <div style="margin-top:20px;display:inline-block;background:rgba(255,200,87,0.08);border:1px solid rgba(255,200,87,0.2);border-radius:8px;padding:12px 24px;">
      <div style="font-size:11px;color:#9a9690;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px;">Estimated Savings</div>
      <div style="font-size:26px;font-weight:700;color:#ffc857;font-family:'Courier New',monospace;">$${monthlySave}<span style="font-size:13px;color:#9a9690;">/mo</span></div>
      <div style="font-size:12px;color:#9a9690;margin-top:2px;">$${annualSave}/yr</div>
    </div>` : ""}
  </div>

  ${aiSection}

  <!-- Findings Table -->
  ${(overlapRows || upgradeRows || wrongRows) ? `
  <div style="background:#16151c;border:1px solid rgba(255,255,255,0.07);border-radius:14px;overflow:hidden;margin-bottom:20px;">
    <div style="padding:16px 20px;border-bottom:1px solid rgba(255,255,255,0.07);">
      <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a9690;font-weight:600;">Findings</div>
    </div>
    <table style="width:100%;border-collapse:collapse;">
      ${wrongRows}
      ${overlapRows}
      ${upgradeRows}
    </table>
  </div>` : ""}

  <!-- Action Plan -->
  ${actionItems ? `
  <div style="background:#16151c;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px 24px;margin-bottom:20px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a9690;font-weight:600;margin-bottom:16px;">Priority Actions</div>
    ${actionItems}
  </div>` : ""}

  <!-- Optimized Stack -->
  ${toolTags ? `
  <div style="background:#16151c;border:1px solid rgba(255,255,255,0.07);border-radius:14px;padding:20px 24px;margin-bottom:28px;">
    <div style="font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#9a9690;font-weight:600;margin-bottom:12px;">Your Optimized Stack</div>
    <div>${toolTags}</div>
  </div>` : ""}

  <!-- StackAudit CTA -->
  <div style="background:rgba(57,255,133,0.04);border:1px solid rgba(57,255,133,0.2);border-radius:14px;padding:24px;margin-bottom:28px;text-align:center;">
    <div style="font-size:10px;letter-spacing:.2em;text-transform:uppercase;color:rgba(57,255,133,0.7);font-weight:600;margin-bottom:8px;">Coming Soon</div>
    <div style="font-size:18px;font-weight:800;color:#f0ece4;margin-bottom:8px;">Want the full consultant-grade breakdown?</div>
    <p style="font-size:13px;color:#9a9690;line-height:1.7;margin:0 0 16px;">StackAudit delivers a tool-by-tool cost breakdown, 30/60/90 implementation plan, risk flags, and a shareable PDF. $99, one-time.</p>
    <a href="https://stackswap-pi.vercel.app/pro.html" style="display:inline-block;background:#39ff85;color:#0f0e13;border-radius:7px;padding:12px 24px;font-size:13px;font-weight:700;text-decoration:none;letter-spacing:.04em;">Join the StackAudit Waitlist →</a>
  </div>

  <!-- Footer -->
  <div style="text-align:center;padding-top:8px;border-top:1px solid rgba(255,255,255,0.05);">
    <div style="font-size:12px;color:#3a3830;margin-bottom:6px;">StackSwap by DemandStack · stackswap-pi.vercel.app</div>
    <div style="font-size:11px;color:#3a3830;">No vendor bias · No sponsored results · AI-generated analysis</div>
  </div>

</div>
</body>
</html>`;
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  const { to_email, reportData } = body || {};

  if (!to_email || !reportData) {
    return res.status(400).json({ error: "Missing to_email or reportData" });
  }

  const RESEND_API_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY not set" });

  const htmlBody = buildReportHTML(reportData);
  const subject = `Your StackScan Report — ${reportData.company}`;

  try {
    const resp = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: "Nick @ StackSwap <onboarding@resend.dev>",
        to: [to_email],
        subject,
        html: htmlBody
      })
    });

    if (!resp.ok) {
      const txt = await resp.text();
      console.error("Resend error:", txt);
      return res.status(502).json({ error: "Email send failed", detail: txt });
    }

    return res.status(200).json({ success: true });
  } catch(e) {
    console.error("Send report error:", e.message);
    return res.status(500).json({ error: e.message });
  }
}
