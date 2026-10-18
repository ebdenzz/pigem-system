// ============================================================
// VERCEL SERVERLESS CLOUD EMAIL FUNCTION (/api/notify)
// Sends transactional emails via Resend directly from Vercel Cloud
// so emails work 24/7 even when the local Python .bat server is off.
// ============================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ sent: false, reason: "Method not allowed" });
  }

  var apiKey = process.env.RESEND_API_KEY || "";
  var fromAddr = process.env.RESEND_FROM || "PIGEM <onboarding@resend.dev>";

  if (!apiKey) {
    return res.status(200).json({ sent: false, reason: "Set RESEND_API_KEY in Vercel Environment Variables." });
  }

  try {
    var body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    var to = String(body.to || "").trim();
    var subject = String(body.subject || "PIGEM Notification").trim();
    var message = String(body.message || "").trim();

    if (!to) {
      return res.status(400).json({ sent: false, reason: "Recipient email is required." });
    }

    var safeHtml =
      "<div style='font-family:Inter,Arial,sans-serif;padding:18px;border:1px solid #e2e8f0;border-radius:10px;max-width:560px'>" +
        "<h3 style='color:#c8102e;margin-top:0'>PIGEM Combined Facilities Support Services</h3>" +
        "<p style='color:#0f172a;line-height:1.6'>" +
          message
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n/g, "<br>") +
        "</p>" +
        "<hr style='border:none;border-top:1px solid #e2e8f0;margin:16px 0'>" +
        "<small style='color:#64748b'>Dasmariñas City, Cavite • Red Fiber Postpaid Application Support</small>" +
      "</div>";

    var response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + apiKey,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: fromAddr,
        to: [to],
        subject: subject,
        html: safeHtml
      })
    });

    var data = await response.json();
    return res.status(200).json({ sent: response.ok, data: data });
  } catch (err) {
    return res.status(200).json({ sent: false, reason: String(err && err.message ? err.message : err) });
  }
}
