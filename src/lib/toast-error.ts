import { toast } from "sonner";
import { errorMessage } from "@/lib/user-error";

/**
 * Show what went wrong in a toast. An action that ends in redirect() rejects with NEXT_REDIRECT after it has already
 * succeeded and the page is moving on: that is not an error, so nothing is shown.
 */
export function toastError(e: unknown) {
  const m = errorMessage(e);
  if (m) toast.error(m);
}
