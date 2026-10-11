/** Width ÷ height, or null when either is missing (a format with no fixed size). */
export const ratioOf = (w: number | null | undefined, h: number | null | undefined): number | null => (w && h && w > 0 && h > 0 ? w / h : null);

/** Ratio from a size label such as "1080 × 1350" or "5 × 7 in"; null for "custom size". */
export function ratioFromSize(size: string | null | undefined): number | null {
  const m = size?.match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/i);
  return m ? ratioOf(Number(m[1]), Number(m[2])) : null;
}

/** "4:5", "16:9", "7:3": the simplest whole-number ratio within 2%, else "2.33:1". */
export function ratioLabel(ratio: number | null): string {
  if (!ratio) return "";
  for (let b = 1; b <= 20; b++) {
    const a = Math.round(ratio * b);
    if (a >= 1 && a <= 32 && Math.abs(a / b - ratio) / ratio < 0.02) return `${a}:${b}`;
  }
  return ratio >= 1 ? `${ratio.toFixed(2)}:1` : `1:${(1 / ratio).toFixed(2)}`;
}
