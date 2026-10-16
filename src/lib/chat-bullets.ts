/** One line of a chat post listing an asset: a link to it when there is one (works in Slack and Google Chat), else plain text. */
export function assetBullet(a: { title: string; format: string; open: number; url?: string | null }): string {
  const label = `${a.title} · ${a.format}`;
  const text = a.url ? `<${a.url}|${label.replace(/[<>|]/g, "")}>` : label;
  return `• ${text}: ${a.open} open change${a.open === 1 ? "" : "s"}`;
}
