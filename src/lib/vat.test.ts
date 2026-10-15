import { describe, expect, it } from 'vitest';
import { formatVat, normalizeVat, validateVat } from './vat';

describe('validation TVA', () => {
  it('accepte un numéro belge valide (clé modulo 97)', () => {
    // 01234567 mod 97 = 48 ; 97 - 48 = 49
    expect(validateVat('BE0123456749')).toEqual({ valid: true, normalized: 'BE0123456749' });
    expect(validateVat('be 0123.456.749')).toEqual({ valid: true, normalized: 'BE0123456749' });
  });

  it('refuse un numéro belge à la clé fausse', () => {
    expect(validateVat('BE0123456789')).toEqual({ valid: false, reason: 'checksum' });
  });

  it('refuse un format belge incorrect', () => {
    expect(validateVat('BE123')).toEqual({ valid: false, reason: 'format' });
    expect(validateVat('BE2123456749')).toEqual({ valid: false, reason: 'format' });
  });

  it('accepte les formats européens courants', () => {
    expect(validateVat('FR40303265045').valid).toBe(true);
    expect(validateVat('NL123456789B01').valid).toBe(true);
    expect(validateVat('DE123456789').valid).toBe(true);
    expect(validateVat('LU12345678').valid).toBe(true);
    expect(validateVat('ATU12345678').valid).toBe(true);
    expect(validateVat('ESX1234567X').valid).toBe(true);
  });

  it('refuse les pays inconnus et les formats européens faux', () => {
    expect(validateVat('US123456789')).toEqual({ valid: false, reason: 'country' });
    expect(validateVat('NL123456789').valid).toBe(false);
    expect(validateVat('DE12345678').valid).toBe(false);
  });

  it('normalise et formate', () => {
    expect(normalizeVat(' be-0123 456 749 ')).toBe('BE0123456749');
    expect(formatVat('BE0123456749')).toBe('BE 0123.456.749');
  });
});
