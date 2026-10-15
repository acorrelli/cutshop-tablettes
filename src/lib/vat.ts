// Validation des numéros de TVA : format belge avec clé de contrôle modulo 97,
// et formats européens courants (contrôle de structure).

const EU_PATTERNS: Record<string, RegExp> = {
  AT: /^ATU\d{8}$/,
  BG: /^BG\d{9,10}$/,
  CY: /^CY\d{8}[A-Z]$/,
  CZ: /^CZ\d{8,10}$/,
  DE: /^DE\d{9}$/,
  DK: /^DK\d{8}$/,
  EE: /^EE\d{9}$/,
  EL: /^EL\d{9}$/,
  ES: /^ES[A-Z0-9]\d{7}[A-Z0-9]$/,
  FI: /^FI\d{8}$/,
  FR: /^FR[A-HJ-NP-Z0-9]{2}\d{9}$/,
  HR: /^HR\d{11}$/,
  HU: /^HU\d{8}$/,
  IE: /^IE\d{7}[A-W][A-I]?$|^IE\d[A-Z+*]\d{5}[A-W]$/,
  IT: /^IT\d{11}$/,
  LT: /^LT(\d{9}|\d{12})$/,
  LU: /^LU\d{8}$/,
  LV: /^LV\d{11}$/,
  MT: /^MT\d{8}$/,
  NL: /^NL\d{9}B\d{2}$/,
  PL: /^PL\d{10}$/,
  PT: /^PT\d{9}$/,
  RO: /^RO\d{2,10}$/,
  SE: /^SE\d{12}$/,
  SI: /^SI\d{8}$/,
  SK: /^SK\d{10}$/,
};

/** Supprime espaces, points, tirets et barres, et passe en majuscules. */
export function normalizeVat(raw: string): string {
  return raw.toUpperCase().replace(/[\s.\-/‐-―]/g, '');
}

export function isValidBelgianVat(normalized: string): boolean {
  const m = /^BE([01]\d{9})$/.exec(normalized);
  if (!m) return false;
  const digits = m[1];
  const base = Number(digits.slice(0, 8));
  const check = Number(digits.slice(8));
  return 97 - (base % 97) === check;
}

export type VatCheck = { valid: true; normalized: string } | { valid: false; reason: 'format' | 'checksum' | 'country' };

export function validateVat(raw: string): VatCheck {
  const v = normalizeVat(raw);
  if (v.length < 4) return { valid: false, reason: 'format' };
  const country = v.slice(0, 2);
  if (country === 'BE') {
    if (!/^BE[01]\d{9}$/.test(v)) return { valid: false, reason: 'format' };
    return isValidBelgianVat(v) ? { valid: true, normalized: v } : { valid: false, reason: 'checksum' };
  }
  const pattern = EU_PATTERNS[country];
  if (!pattern) return { valid: false, reason: 'country' };
  return pattern.test(v) ? { valid: true, normalized: v } : { valid: false, reason: 'format' };
}

/** Affichage lisible : BE 0123.456.789 */
export function formatVat(normalized: string): string {
  const m = /^BE(\d{4})(\d{3})(\d{3})$/.exec(normalized);
  return m ? `BE ${m[1]}.${m[2]}.${m[3]}` : normalized;
}
