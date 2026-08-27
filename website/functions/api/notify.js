/**
 * Cloudflare Pages Function — POST /api/notify
 * ---------------------------------------------------------------
 * Collects launch-list email sign-ups from the landing page.
 *
 * It works in three optional, additive layers — configure whichever
 * you like in the Cloudflare Pages dashboard (Settings → Functions):
 *
 *   1. KV storage      → bind a KV namespace named  NOTIFY_KV
 *                        (Settings → Functions → KV namespace bindings)
 *                        Every email is stored as a key for later export.
 *
 *   2. Email via Resend → set env var  RESEND_API_KEY  (resend.com)
 *                        and optionally  NOTIFY_TO (defaults support@urmiaworks.com)
 *                        and  NOTIFY_FROM (a verified sender on your domain,
 *                        e.g. "Urmia Works <notify@urmiaworks.com>").
 *                        Each sign-up is emailed to you.
 *
 *   3. Email via the Cloudflare Email Sending binding → bind  EMAIL
 *                        (send_email) and onboard the domain. Used first when
 *                        present; no API key needed.
 *
 *   4. Nothing configured → it returns { ok:true, delivered:false } so the
 *                        front-end opens the visitor's mail app addressed to
 *                        support@urmiaworks.com (the live mailbox), and the
 *                        message still reaches you.
 *
 * No secrets live in this file — everything sensitive comes from env vars.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "invalid_json" }, 400);
  }

  const email = String(body?.email || "").trim().toLowerCase();
  const honeypot = String(body?.website || "").trim();
  const source = String(body?.source || "landing").slice(0, 40);

  // Honeypot: silently accept and drop bots.
  if (honeypot) return json({ ok: true });

  if (!EMAIL_RE.test(email) || email.length > 254) {
    return json({ ok: false, error: "invalid_email" }, 422);
  }

  const record = {
    email,
    source,
    at: new Date().toISOString(),
    ip: request.headers.get("cf-connecting-ip") || "",
    ua: (request.headers.get("user-agent") || "").slice(0, 200),
  };

  // ---- Layer 1: store in KV (if bound) ----
  try {
    if (env.NOTIFY_KV) {
      await env.NOTIFY_KV.put(`signup:${email}`, JSON.stringify(record));
    }
  } catch (e) {
    // Storage failure shouldn't break the visitor's experience.
    console.error("KV put failed", e);
  }

  const to = env.NOTIFY_TO || "support@urmiaworks.com";
  const subject = "New launch-list sign-up";
  const text =
    `New sign-up for the Urmia Works launch list:\n\n` +
    `Email:  ${email}\n` +
    `Source: ${source}\n` +
    `Time:   ${record.at}\n` +
    `IP:     ${record.ip}\n`;
  let delivered = false;

  // ---- Layer 2: Cloudflare Email Sending binding (no API key) ----
  try {
    if (env.EMAIL && typeof env.EMAIL.send === "function") {
      await env.EMAIL.send({
        to,
        from: {
          email: env.NOTIFY_FROM_ADDR || "notify@urmiaworks.com",
          name: "Urmia Works",
        },
        replyTo: email,
        subject,
        text,
      });
      delivered = true;
    }
  } catch (e) {
    console.error("Email binding send failed", e);
  }

  // ---- Layer 3: email notification via Resend (if configured) ----
  try {
    if (!delivered && env.RESEND_API_KEY) {
      const from = env.NOTIFY_FROM || "Urmia Works <support@urmiaworks.com>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.RESEND_API_KEY}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [to],
          reply_to: email,
          subject,
          text,
        }),
      });
      delivered = res.ok;
    }
  } catch (e) {
    console.error("notify email failed", e);
  }

  // delivered:false → front-end opens a mailto to support@urmiaworks.com
  // so the sign-up still reaches the live mailbox.
  return json({ ok: true, delivered });
}

// Reject other methods cleanly.
export async function onRequest(context) {
  if (context.request.method === "POST") return onRequestPost(context);
  return json({ ok: false, error: "method_not_allowed" }, 405);
}
