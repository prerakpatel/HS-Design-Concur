/**
 * Uploading to an asset makes the uploader its designer when that is clearly right: nobody is assigned, or another
 * designer was. A Core Admin or approver uploading (a quick fix, say) only fills an empty spot; they never take an asset
 * away from the person it was given to, whatever other tags they carry.
 */
export function takesOver(a: { uploader: string; assignee: string | null; privileged: boolean }): boolean {
  if (a.assignee === a.uploader) return false;
  if (!a.assignee) return true;
  return !a.privileged;
}
