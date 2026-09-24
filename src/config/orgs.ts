/** Display names for the two organizations. Slugs match the `organisations` table. */
export const ORGS = {
  harisumiran: { slug: "harisumiran", name: "Harisumiran", short: "Harisumiran", letter: "H" },
  acc: { slug: "acc", name: "Atmiya Care Charities", short: "ACC", letter: "A" },
} as const;
export type OrgSlug = keyof typeof ORGS;
export const DEFAULT_ORG: OrgSlug = "harisumiran";
export const APP_TIMEZONE = process.env.APP_TIMEZONE ?? "America/New_York";

/** Where most events happen. Prefilled on a new event; anyone can overwrite it for the odd event elsewhere. */
export const DEFAULT_VENUE = { name: "Harisumiran NJ", address: "2 Lincoln Ave, Lake Hiawatha, NJ 07034" };
