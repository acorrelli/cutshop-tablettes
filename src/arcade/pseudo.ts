// Pseudos des joueurs : 15 caractères au plus, sans termes offensants, jamais obligatoires.

export const PSEUDO_MAX = 15;

// Listes volontairement courtes et extensibles (français, néerlandais, anglais), comparées sans accents.
// Mots entiers : bloqués seulement s'ils forment un mot du pseudo (« Monique » reste autorisé).
const BLOCKED_WORDS = [
  'con', 'conne', 'pute', 'merde', 'nique', 'niquer', 'ntm', 'fdp', 'pd', 'pede', 'tapette', 'negre', 'nazi', 'bite',
  'couille', 'chatte', 'teub', 'zizi', 'abruti', 'debile', 'gogol', 'mongol', 'cul', 'kut', 'lul', 'hoer', 'kanker',
  'tering', 'mongool', 'flikker', 'cunt', 'shit', 'bitch', 'dick', 'cock', 'slut', 'fag', 'retard', 'rape', 'porn', 'sex', 'xxx',
];
// Fragments sans ambiguïté : bloqués même collés à d'autres lettres (« fuckyou »).
const BLOCKED_PARTS = [
  'connard', 'connasse', 'salope', 'salaud', 'putain', 'encule', 'batard', 'bougnoule', 'youpin', 'hitler', 'branleur',
  'trisomique', 'klootzak', 'fuck', 'pussy', 'whore', 'nigger', 'nigga', 'faggot',
];

/** Forme de comparaison : minuscules, sans accents, chiffres « leet » convertis, lettres seules. */
function canonical(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/0/g, 'o')
    .replace(/1/g, 'i')
    .replace(/3/g, 'e')
    .replace(/4/g, 'a')
    .replace(/5/g, 's')
    .replace(/7/g, 't')
    .replace(/@/g, 'a')
    .replace(/\$/g, 's');
}

export function isOffensive(pseudo: string): boolean {
  const c = canonical(pseudo);
  const words = c.split(/[^a-z]+/).filter(Boolean);
  const joined = c.replace(/[^a-z]/g, '');
  return BLOCKED_WORDS.some((b) => words.includes(b)) || BLOCKED_PARTS.some((b) => joined.includes(b));
}

/** Nettoie la saisie : espaces superflus, caractères de contrôle, longueur maximale. */
export function cleanPseudo(raw: string): string {
  return raw
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PSEUDO_MAX);
}

export type PseudoCheck = { ok: true; pseudo: string } | { ok: false; error: 'empty' | 'offensive' };

export function checkPseudo(raw: string): PseudoCheck {
  const pseudo = cleanPseudo(raw);
  if (pseudo.length < 2) return { ok: false, error: 'empty' };
  if (isOffensive(pseudo)) return { ok: false, error: 'offensive' };
  return { ok: true, pseudo };
}

/** Pseudo anonyme, différent à chaque session. */
export function anonymousPseudo(rand = Math.random): string {
  return `Joueur ${String(Math.floor(rand() * 9000) + 1000)}`;
}

/** Clé de regroupement des classements : un même pseudo, quelle que soit la casse ou l'accentuation. */
export function pseudoKey(pseudo: string): string {
  return pseudo
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
