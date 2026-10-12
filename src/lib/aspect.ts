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

/**
 * Whole-number scale of a file against the size asked for: 1 for the exact size, 2 for @2x, 3, 4… or null when it
 * is not a clean multiple (give or take a pixel per step). A 2160 × 2700 file for a 1080 × 1350 format is 2.
 */
export function wholeScale(fileW: number, fileH: number, specW: number, specH: number, max = 4): number | null {
  if (!(fileW > 0 && fileH > 0 && specW > 0 && specH > 0)) return null;
  const k = Math.round(fileW / specW);
  if (k < 1 || k > max) return null;
  return Math.abs(fileW - k * specW) <= k && Math.abs(fileH - k * specH) <= k ? k : null;
}
