/** Transactional email via Resend's HTTP API. Skips silently when RESEND_API_KEY is not set. */
const API = "https://api.resend.com/emails";

export function appUrl(path = "/") {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://hsdesign.vercel.app";
  return base.replace(/\/$/, "") + path;
}

export function emailConfigured() { return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM); }

export async function sendEmail(to: string, subject: string, opts: { heading: string; body: string; cta?: { label: string; href: string }; footer?: string }) {
  if (!emailConfigured()) return { skipped: true as const };
  const html = renderEmail(opts);
  const text = `${opts.heading}\n\n${opts.body}${opts.cta ? `\n\n${opts.cta.label}: ${opts.cta.href}` : ""}\n\n${opts.footer ?? ""}`;
  const res = await fetch(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [to], subject, html, text }),
  });
  if (!res.ok) return { error: `Resend ${res.status}: ${(await res.text()).slice(0, 200)}` };
  return { ok: true as const };
}

function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string)); }

/** Plain, brand-quiet template that renders in Gmail and Apple Mail. */
export function renderEmail({ heading, body, cta, footer }: { heading: string; body: string; cta?: { label: string; href: string }; footer?: string }) {
  return `<!doctype html><html><body style="margin:0;background:#fafafa;font-family:'Google Sans Flex','Google Sans',system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#09090b">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e4e4e7;border-radius:16px">
<tr><td style="padding:28px 28px 8px"><span style="display:inline-block;width:28px;height:28px;border-radius:8px;background:#ff5a52;vertical-align:middle"></span><span style="display:inline-block;margin-left:10px;font-size:13px;color:#52525b;vertical-align:middle">Design &amp; Concur</span></td></tr>
<tr><td style="padding:12px 28px 0;font-size:20px;font-weight:600;line-height:28px">${esc(heading)}</td></tr>
<tr><td style="padding:10px 28px 0;font-size:15px;line-height:24px;color:#3f3f46">${esc(body).replace(/\n/g, "<br>")}</td></tr>
${cta ? `<tr><td style="padding:22px 28px 0"><a href="${esc(cta.href)}" style="display:inline-block;background:#18181b;color:#fafafa;text-decoration:none;font-size:14px;font-weight:500;padding:11px 18px;border-radius:10px">${esc(cta.label)}</a></td></tr>` : ""}
<tr><td style="padding:24px 28px 28px;font-size:12px;line-height:18px;color:#71717a">${esc(footer ?? "You get this because you are on the event. Change email preferences from your Inbox in the app.")}</td></tr>
</table></td></tr></table></body></html>`;
}
