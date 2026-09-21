/** Google Chat incoming webhook. One POST per announcement; failures are logged, never thrown. */
export async function postChat(webhookUrl: string, text: string) {
  try {
    const res = await fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json; charset=UTF-8" }, body: JSON.stringify({ text }) });
    if (!res.ok) return { error: `Google Chat ${res.status}: ${(await res.text()).slice(0, 200)}` };
    return { ok: true as const };
  } catch (e) { return { error: (e as Error).message }; }
}

/** Google Chat text formatting: *bold*, _italic_, <url|label>. */
export const chat = { bold: (s: string) => `*${s.replace(/\*/g, "")}*`, link: (url: string, label: string) => `<${url}|${label.replace(/[<>|]/g, "")}>` };
