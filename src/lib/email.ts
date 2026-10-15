export function isValidEmail(raw: string): boolean {
  const v = raw.trim();
  return v.length <= 254 && /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(v);
}
