import { describe, expect, it } from 'vitest';
import { anonymousPseudo, checkPseudo, cleanPseudo, isOffensive, pseudoKey, PSEUDO_MAX } from './pseudo';

describe('pseudos', () => {
  it('limite à 15 caractères et nettoie la saisie', () => {
    expect(cleanPseudo('  Le   Barbier  du  Cutshop Mons ')).toHaveLength(PSEUDO_MAX);
    expect(cleanPseudo('Sam<script>')).toBe('Samscript');
  });

  it('refuse les termes offensants, même déguisés', () => {
    for (const p of ['connard', 'C0NN4RD', 'fuckyou', 'Sale pute', 'nique ta', 'Klootzak!']) expect(isOffensive(p)).toBe(true);
  });

  it('accepte les prénoms qui contiennent un fragment anodin', () => {
    for (const p of ['Monique', 'Computer', 'Scunthorpe', 'Constance', 'Catering', 'Habiteur', 'Pascal']) expect(isOffensive(p)).toBe(false);
  });

  it('valide ou explique le refus', () => {
    expect(checkPseudo('A')).toEqual({ ok: false, error: 'empty' });
    expect(checkPseudo('salope')).toEqual({ ok: false, error: 'offensive' });
    expect(checkPseudo(' Léa ')).toEqual({ ok: true, pseudo: 'Léa' });
  });

  it('propose un pseudo anonyme et regroupe les variantes d’un même pseudo', () => {
    expect(anonymousPseudo(() => 0.5)).toBe('Joueur 5500');
    expect(pseudoKey('  LÉA ')).toBe(pseudoKey('lea'));
  });
});
