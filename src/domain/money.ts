/**
 * Financial amounts are stored and computed as integer minor units (fils/cents)
 * to avoid IEEE-754 drift. Display layer converts back to major units.
 *
 * Convention for this app (YER often has no fractional display):
 * we still use 2 decimal places of precision (×100) for safety.
 */
export type Money = number; // integer minor units

export function toMinor(major: number): Money {
  if (!Number.isFinite(major)) return 0;
  return Math.round(major * 100);
}

export function toMajor(minor: Money): number {
  return minor / 100;
}

export function addMoney(a: Money, b: Money): Money {
  return a + b;
}

export function subMoney(a: Money, b: Money): Money {
  return a - b;
}

/** Compare major-unit amounts with 2-decimal equality. */
export function moneyEquals(a: number, b: number): boolean {
  return toMinor(a) === toMinor(b);
}
