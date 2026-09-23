/** Google Chat or Slack incoming webhook: both take { text } with the same *bold* and <url|label> markup. Failures are returned, never thrown. */
export async function postChat(webhookUrl: string, text: string) {
  try {
    const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ text }) });
    if (!res.ok) return { error: `Webhook ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Chat text formatting shared by Google Chat and Slack: *bold*, _italic_, <url|label>. */
export const chat = { bold: (s: string) => `*${s.replace(/\*/g, "")}*`, link: (url: string, label: string) => `<${url}|${label.replace(/[<>|]/g, "")}>` };
