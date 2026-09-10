/**
 * Canonical phone identity used by employee accounts.
 *
 * Yemen employee numbers are stored without the country code and without a
 * trunk prefix, so `+967 773303455`, `00967 773303455`, `967773303455`,
 * `0773303455`, and `773303455` resolve to the same Better Auth email.
 */
export function normalizePhone(value: unknown): string {
  const arabicDigits = String(value ?? "").replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  );
  let digits = arabicDigits.replace(/\D/g, "");
  if (digits.startsWith("00967")) digits = digits.slice(5);
  else if (digits.startsWith("967")) digits = digits.slice(3);
  if (digits.startsWith("0") && digits.length === 10) digits = digits.slice(1);
  return digits;
}

export function phoneAccountEmail(phone: string): string {
  return `phone-${normalizePhone(phone)}@accounts.hashem.local`;
}

/** Legacy identities allow existing accounts to keep working after rollout. */
export function phoneAccountEmailCandidates(phone: string): string[] {
  const canonical = normalizePhone(phone);
  const digits = String(phone ?? "").replace(/[٠-٩]/g, (digit) =>
    String("٠١٢٣٤٥٦٧٨٩".indexOf(digit)),
  ).replace(/\D/g, "");
  const values = new Set([canonical, digits]);
  if (canonical) {
    values.add(`0${canonical}`);
    values.add(`967${canonical}`);
    values.add(`00967${canonical}`);
  }
  return [...values].filter(Boolean).map((value) => `phone-${value}@accounts.hashem.local`);
}
