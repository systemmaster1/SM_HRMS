/** Normalises an Indian mobile number to E.164, e.g. +919876543210 */
export function normalisePhone(input: string): string | null {
  const digits = (input || "").replace(/\D/g, "");
  const last10 = digits.slice(-10);
  if (last10.length !== 10) return null;
  if (!/^[6-9]/.test(last10)) return null;
  return `+91${last10}`;
}

export function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((input || "").trim());
}
