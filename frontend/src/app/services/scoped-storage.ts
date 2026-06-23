/**
 * Per-user localStorage helpers.
 *
 * Some convenience data is stored only on the device (e.g. spouse/partner income
 * and retirement contributions in Cash Flow). If those keys are global, a second
 * account signing in on the same browser/app would read the first account's
 * financial values. Scoping every such key by the authenticated user id keeps
 * each account's device-local data isolated.
 */

/** Returns a localStorage key namespaced to the given user id. */
export function userScopedKey(base: string, userId: number | null | undefined): string {
  return userId != null ? `${base}__u${userId}` : base;
}

/**
 * Device-local financial keys that were historically stored under GLOBAL names
 * (shared across accounts on one browser). These are migrated to per-user keys
 * at authentication time so no account can read another's values.
 */
export const LEGACY_DEVICE_FINANCIAL_KEYS = [
  'clarity_second_income',
  'clarity_second_income_enabled',
  'clarity_retirement',
  'clarity_401k_pct',
  'clarity_401k_pct_2',
];

export function migrateGlobalKeys(bases: string[], userId: number | null | undefined): void {
  for (const b of bases) migrateGlobalKey(b, userId);
}

/**
 * One-time migration: if a legacy GLOBAL key exists, copy its value into the
 * current user's scoped key (only if the scoped key is empty), then DELETE the
 * global key so it can never be read by a different account afterward.
 *
 * On a single-user device this preserves the owner's data; the global key is
 * removed immediately so no later account can inherit it.
 */
export function migrateGlobalKey(base: string, userId: number | null | undefined): void {
  if (userId == null) return;
  const legacy = localStorage.getItem(base);
  if (legacy === null) return;
  const scoped = userScopedKey(base, userId);
  if (localStorage.getItem(scoped) === null) localStorage.setItem(scoped, legacy);
  localStorage.removeItem(base);
}
