"use server";

/** No-op actions for the design preview harness (DESIGN_PREVIEW=1 only). */
export async function noop(): Promise<void> {}
export async function noopForm(): Promise<void> {}
export async function noopUser(): Promise<void> {}
