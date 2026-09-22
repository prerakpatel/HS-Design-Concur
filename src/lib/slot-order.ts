/**
 * Order formats the way people work: the primary design first, then whatever was uploaded first,
 * then the rest in catalog order (PRD §6, v1.1: no fixed ranking).
 */
export function orderSlots<T extends { is_primary?: boolean; firstUploadAt: string | null; sort: number }>(slots: T[]): T[] {
  return [...slots].sort((a, b) => {
    if (!!a.is_primary !== !!b.is_primary) return a.is_primary ? -1 : 1;
    if (a.firstUploadAt && b.firstUploadAt) return a.firstUploadAt.localeCompare(b.firstUploadAt);
    if (a.firstUploadAt || b.firstUploadAt) return a.firstUploadAt ? -1 : 1;
    return a.sort - b.sort;
  });
}
