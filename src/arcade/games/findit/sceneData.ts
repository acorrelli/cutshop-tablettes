// Données pures des scènes de Find It Cutshop : position et taille des objets à trouver (repère 1000 x 700).
// Les dessins sont dans art.tsx et scenes.tsx ; le moteur n'utilise que ces données (test de toucher compris).

export const SCENE_W = 1000;
export const SCENE_H = 700;
/** Rayon minimal de la zone de toucher d'un objet (unités de scène, environ 70 px de diamètre à x1). */
export const MIN_HIT_R = 36;

export type ObjectKey =
  | 'comb' | 'scissors' | 'clipper' | 'brush' | 'razor' | 'spray' | 'handmirror' | 'pole' | 'mustache' | 'towel' | 'pomade' | 'clock'
  | 'tulip' | 'pint' | 'bottle' | 'opener' | 'coaster' | 'hops' | 'keg' | 'pretzel' | 'lemon' | 'shaker' | 'candle'
  | 'beardoil' | 'perfume' | 'plant' | 'cactus' | 'book' | 'hat' | 'sunglasses' | 'frame' | 'bowtie' | 'camera' | 'watch'
  | 'vinyl' | 'headphones' | 'mic' | 'speaker' | 'cassette' | 'discoball' | 'sneaker' | 'lamp' | 'cap' | 'skate' | 'guitar';

export const OBJECT_NAMES: Record<ObjectKey, { fr: string; en: string }> = {
  comb: { fr: 'Peigne', en: 'Comb' },
  scissors: { fr: 'Ciseaux', en: 'Scissors' },
  clipper: { fr: 'Tondeuse', en: 'Clipper' },
  brush: { fr: 'Blaireau', en: 'Shaving brush' },
  razor: { fr: 'Rasoir', en: 'Razor' },
  spray: { fr: 'Vaporisateur', en: 'Spray bottle' },
  handmirror: { fr: 'Miroir à main', en: 'Hand mirror' },
  pole: { fr: 'Enseigne barbier', en: 'Barber pole' },
  mustache: { fr: 'Moustache', en: 'Mustache' },
  towel: { fr: 'Serviettes', en: 'Towels' },
  pomade: { fr: 'Pot de cire', en: 'Pomade tin' },
  clock: { fr: 'Horloge', en: 'Clock' },
  tulip: { fr: 'Verre tulipe', en: 'Tulip glass' },
  pint: { fr: 'Pinte', en: 'Pint' },
  bottle: { fr: 'Bouteille', en: 'Beer bottle' },
  opener: { fr: 'Décapsuleur', en: 'Bottle opener' },
  coaster: { fr: 'Sous bock', en: 'Coaster' },
  hops: { fr: 'Houblon', en: 'Hops' },
  keg: { fr: 'Fût', en: 'Keg' },
  pretzel: { fr: 'Bretzel', en: 'Pretzel' },
  lemon: { fr: 'Citron', en: 'Lemon' },
  shaker: { fr: 'Shaker', en: 'Shaker' },
  candle: { fr: 'Bougie', en: 'Candle' },
  beardoil: { fr: 'Huile à barbe', en: 'Beard oil' },
  perfume: { fr: 'Parfum', en: 'Cologne' },
  plant: { fr: 'Plante', en: 'Plant' },
  cactus: { fr: 'Cactus', en: 'Cactus' },
  book: { fr: 'Livres', en: 'Books' },
  hat: { fr: 'Chapeau', en: 'Hat' },
  sunglasses: { fr: 'Lunettes', en: 'Sunglasses' },
  frame: { fr: 'Cadre', en: 'Frame' },
  bowtie: { fr: 'Noeud papillon', en: 'Bow tie' },
  camera: { fr: 'Appareil photo', en: 'Camera' },
  watch: { fr: 'Montre', en: 'Watch' },
  vinyl: { fr: 'Vinyle', en: 'Vinyl' },
  headphones: { fr: 'Casque DJ', en: 'Headphones' },
  mic: { fr: 'Micro', en: 'Mic' },
  speaker: { fr: 'Enceinte', en: 'Speaker' },
  cassette: { fr: 'Cassette', en: 'Tape' },
  discoball: { fr: 'Boule disco', en: 'Disco ball' },
  sneaker: { fr: 'Basket', en: 'Sneaker' },
  lamp: { fr: 'Lampe', en: 'Lamp' },
  cap: { fr: 'Casquette', en: 'Cap' },
  skate: { fr: 'Skate', en: 'Skateboard' },
  guitar: { fr: 'Guitare', en: 'Guitar' },
};

/** Objet posé dans une scène : dessin centré en (x, y), mis à l'échelle s (le dessin tient dans 100 x 100), tourné de r degrés. */
export interface Placement {
  key: ObjectKey;
  x: number;
  y: number;
  s: number;
  r?: number;
  /** Rayon de toucher imposé (sinon calculé depuis la taille). */
  hr?: number;
}

export interface SceneDef {
  name: { fr: string; en: string };
  objects: Placement[];
}

export const SCENES: SceneDef[] = [
  {
    name: { fr: 'Le salon', en: 'The barbershop' },
    objects: [
      { key: 'comb', x: 238, y: 376, s: 0.6, r: -8 },
      { key: 'scissors', x: 668, y: 374, s: 0.62, r: 18 },
      { key: 'clipper', x: 828, y: 351, s: 0.62, r: 12 },
      { key: 'brush', x: 128, y: 353, s: 0.6 },
      { key: 'razor', x: 944, y: 472, s: 0.58, r: -12 },
      { key: 'spray', x: 540, y: 347, s: 0.62 },
      { key: 'handmirror', x: 712, y: 548, s: 0.58, r: 32 },
      { key: 'pole', x: 486, y: 214, s: 0.95 },
      { key: 'mustache', x: 262, y: 196, s: 0.5, r: -6 },
      { key: 'towel', x: 66, y: 602, s: 0.72 },
      { key: 'pomade', x: 930, y: 243, s: 0.5 },
      { key: 'clock', x: 486, y: 78, s: 0.67 },
    ],
  },
  {
    name: { fr: 'Le bar', en: 'The bar' },
    objects: [
      { key: 'tulip', x: 236, y: 361, s: 0.79 },
      { key: 'pint', x: 724, y: 359, s: 0.77 },
      { key: 'bottle', x: 838, y: 359, s: 0.77 },
      { key: 'opener', x: 566, y: 420, s: 0.5, r: -22 },
      { key: 'coaster', x: 128, y: 408, s: 0.5 },
      { key: 'hops', x: 80, y: 76, s: 0.6, r: 10 },
      { key: 'keg', x: 82, y: 296, s: 0.74 },
      { key: 'pretzel', x: 420, y: 414, s: 0.5, r: -8 },
      { key: 'lemon', x: 934, y: 404, s: 0.48 },
      { key: 'shaker', x: 838, y: 233, s: 0.62 },
      { key: 'candle', x: 328, y: 374, s: 0.5 },
    ],
  },
  {
    name: { fr: 'L’étagère', en: 'The shelf' },
    objects: [
      { key: 'beardoil', x: 150, y: 162, s: 0.6 },
      { key: 'perfume', x: 610, y: 312, s: 0.6 },
      { key: 'plant', x: 860, y: 152, s: 0.79 },
      { key: 'cactus', x: 380, y: 471, s: 0.6 },
      { key: 'book', x: 470, y: 161, s: 0.74 },
      { key: 'hat', x: 760, y: 476, s: 0.74 },
      { key: 'sunglasses', x: 252, y: 328, s: 0.58, r: -6 },
      { key: 'frame', x: 864, y: 309, s: 0.67, r: 4 },
      { key: 'bowtie', x: 140, y: 487, s: 0.55, r: 8 },
      { key: 'camera', x: 536, y: 627, s: 0.66 },
      { key: 'candle', x: 304, y: 168, s: 0.48 },
      { key: 'watch', x: 830, y: 640, s: 0.53, r: 80 },
    ],
  },
  {
    name: { fr: 'Le coin DJ', en: 'The DJ corner' },
    objects: [
      { key: 'vinyl', x: 140, y: 548, s: 0.74, r: -14 },
      { key: 'headphones', x: 506, y: 388, s: 0.62 },
      { key: 'mic', x: 812, y: 300, s: 0.67, r: 14 },
      { key: 'speaker', x: 930, y: 598, s: 0.86 },
      { key: 'cassette', x: 730, y: 418, s: 0.48, r: 8 },
      { key: 'discoball', x: 500, y: 92, s: 0.72 },
      { key: 'sneaker', x: 380, y: 648, s: 0.67, r: -4 },
      { key: 'lamp', x: 282, y: 381, s: 0.6 },
      { key: 'cap', x: 88, y: 226, s: 0.6, r: -10 },
      { key: 'skate', x: 966, y: 320, s: 0.8, r: 90 },
      { key: 'guitar', x: 225, y: 224, s: 0.98 },
      { key: 'plant', x: 62, y: 394, s: 0.79 },
    ],
  },
];

export function hitRadius(p: Placement): number {
  return p.hr ?? Math.max(MIN_HIT_R, 46 * p.s);
}

/**
 * Objet touché en (x, y) dans la scène : renvoie toutes les clés dont la zone contient le point,
 * de la plus proche à la plus lointaine (distance rapportée au rayon).
 */
export function hitKeys(scene: number, x: number, y: number): ObjectKey[] {
  const out: { key: ObjectKey; d: number }[] = [];
  for (const p of SCENES[scene].objects) {
    const d = Math.hypot(x - p.x, y - p.y) / hitRadius(p);
    if (d <= 1) out.push({ key: p.key, d });
  }
  return out.sort((a, b) => a.d - b.d).map((o) => o.key);
}
