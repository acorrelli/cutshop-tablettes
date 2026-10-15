// Données d'exemple : elles servent au mode démonstration et sont converties en SQL
// (supabase/seed.sql) par scripts/generate-seed.mjs. Une seule source de vérité.
// Règle de rédaction : aucun tiret dans les textes affichés.

import type {
  AppSettings,
  CutEvent,
  Drink,
  EventKind,
  Pairing,
  Product,
  QuizQuestion,
  QuizTheme,
  WheelPrize,
} from '../lib/types';

export const DEFAULT_SETTINGS: AppSettings = {
  salonkee_url: 'https://salonkee.be/salon/cutshop-mons',
  instagram_url: 'https://www.instagram.com/cutshop_mons/',
  facebook_url: 'https://www.facebook.com/cutshopmons/',
  tiktok_url: 'https://www.tiktok.com/@cutshop_belgium',
  website: 'www.cutshop.be',
  address: 'Rue de la Chaussée 40, 7000 Mons',
  phone: '065/67.60.66',
  email: 'contact@cutshop.be',
  hours_fr: 'Mardi et mercredi : 10h à 18h\nJeudi : 10h à 18h\nVendredi : 8h à 18h',
  hours_en: 'Tuesday and Wednesday: 10am to 6pm\nThursday: 10am to 6pm\nFriday: 8am to 6pm',
  concept_title_fr: 'Cutshop, bien plus qu’une coupe',
  concept_title_en: 'Cutshop, much more than a haircut',
  concept_body_fr: [
    'Tout commence en 2018, au coeur de Mons, avec une idée simple : et si passer chez le barbier devenait un vrai moment ? Le Cutshop naît de cette envie de mélanger trois univers qui vont parfaitement ensemble : un barbershop exigeant, un bar convivial et un lieu de vie ouvert à la culture.',
    'Ici, on vient pour une coupe ou une barbe taillée dans les règles de l’art, et on reste pour l’ambiance. Une bière du terroir belge à la main, on discute, on rencontre, on prend son temps.',
    'Depuis deux ans, une nouvelle équipe a repris le flambeau avec la même passion. Le concept a été relancé et renforcé, avec toujours plus de services, de soins et d’événements.',
    'Car le Cutshop se transforme aussi régulièrement en scène : DJ sets, artistes locaux, impro, stand up, soirées discussion, soirées lecture... Un lieu où chacun trouve sa place, que tu viennes pour ta coupe du mois ou pour passer une bonne soirée.',
  ].join('\n\n'),
  concept_body_en: [
    'It all started in 2018, in the heart of Mons, with a simple idea: what if going to the barber became a real moment? Cutshop was born from the urge to blend three worlds that go perfectly together: a demanding barbershop, a friendly bar and a place open to culture.',
    'Here, you come for a cut or a beard trimmed by the book, and you stay for the vibe. A local Belgian beer in hand, you chat, you meet people, you take your time.',
    'For the past two years, a new team has carried the torch with the same passion. The concept has been relaunched and strengthened, with ever more services, treatments and events.',
    'Because Cutshop also regularly turns into a stage: DJ sets, local artists, improv, stand up, discussion nights, reading nights... A place where everyone finds their spot, whether you come for your monthly cut or for a great night out.',
  ].join('\n\n'),
  concept_tagline_fr: 'Le Cutshop, c’est ton moment.',
  concept_tagline_en: 'Cutshop is your moment.',
  concept_photo_hero: 'photo:vitrine-cutshop',
  concept_photo_1: 'photo:le-barbershop',
  concept_photo_2: 'photo:le-bar',
  concept_photo_3: 'photo:les-events',
  block_barber_fr: 'Coupes, dégradés, barbes taillées et rasages à l’ancienne. Un savoir faire exigeant, dans une ambiance détendue.',
  block_barber_en: 'Cuts, fades, beard trims and old school shaves. Demanding craftsmanship in a relaxed atmosphere.',
  block_bar_fr: 'Des bières belges du terroir, des softs et un comptoir où l’on prend le temps de discuter.',
  block_bar_en: 'Local Belgian beers, soft drinks and a counter where people take the time to talk.',
  block_events_fr: 'DJ sets, scène ouverte, impro, stand up, soirées discussion et lecture. Le salon devient une scène.',
  block_events_en: 'DJ sets, open mic, improv, stand up, talk nights and reading nights. The shop becomes a stage.',
  gift_title_fr: 'Offre un moment Cutshop',
  gift_title_en: 'Give a Cutshop moment',
  gift_body_fr:
    'Une coupe, une barbe, un soin ou une soirée au bar : le chèque cadeau Cutshop, c’est le cadeau qui fait plaisir à coup sûr. Choisis le montant ou la prestation, on s’occupe du reste. Disponible directement au comptoir.',
  gift_body_en:
    'A cut, a beard, a treatment or a night at the bar: the Cutshop gift voucher is the present that always hits the spot. Choose the amount or the service, we take care of the rest. Available right at the counter.',
  gift_amounts: '25 €, 50 €, 75 €, 100 € (exemple)',
  gift_validity_fr: 'Valable 12 mois à partir de la date d’achat (exemple)',
  gift_validity_en: 'Valid for 12 months from the purchase date (example)',
  gift_conditions_fr: 'Utilisable en une ou plusieurs fois, non remboursable, valable sur toutes les prestations et au bar (exemple, à compléter)',
  gift_conditions_en: 'Can be used in one or several visits, non refundable, valid on all services and at the bar (example, to be completed)',
  invoice_title_fr: 'Indépendant ou société ? On te fait ta facture',
  invoice_title_en: 'Freelancer or company? We’ll make you an invoice',
  invoice_body_fr:
    'Tes prestations et achats au Cutshop peuvent être facturés au nom de ton entreprise. Il te suffit de nous transmettre tes coordonnées de facturation.',
  invoice_body_en:
    'Your services and purchases at Cutshop can be invoiced in your company’s name. All you need to do is send us your billing details.',
  privacy_fr: [
    'Responsable du traitement : Cutshop Mons (coordonnées à compléter dans l’espace admin).',
    'Données collectées : prénom, nom, adresse mail et nombre de places pour les inscriptions aux événements ; adresse mail pour la newsletter si tu l’acceptes ; coordonnées de facturation pour les factures pros ; prénom et sélection de produits pour les conseils produits.',
    'Pourquoi : gérer ton inscription, t’envoyer la newsletter si tu l’as demandée, établir ta facture ou préparer ton conseil produit. Rien d’autre, et aucune revente.',
    'Conservation : les inscriptions sont supprimées +/ 3 mois après l’événement ; la newsletter jusqu’à ta désinscription ; les données de facturation selon les obligations comptables légales.',
    'Tablettes : aucune donnée personnelle n’est conservée sur les tablettes. Les formulaires sont effacés après chaque envoi et après 60 secondes d’inactivité.',
    'Hébergement : base de données Supabase, hébergée dans l’Union européenne.',
    'Tes droits : accès, rectification, effacement, opposition et retrait du consentement à tout moment, sur simple demande au comptoir ou par mail. Tu peux aussi contacter l’Autorité de protection des données (autoriteprotectiondonnees.be).',
  ].join('\n\n'),
  privacy_en: [
    'Data controller: Cutshop Mons (contact details to be completed in the admin area).',
    'Data collected: first name, last name, email address and number of seats for event registrations; email address for the newsletter if you opt in; billing details for business invoices; first name and product selection for product advice.',
    'Why: to manage your registration, send you the newsletter if you asked for it, issue your invoice or prepare your product advice. Nothing else, and never sold.',
    'Retention: registrations are deleted +/ 3 months after the event; newsletter data until you unsubscribe; billing data as required by accounting law.',
    'Tablets: no personal data is stored on the tablets. Forms are cleared after each submission and after 60 seconds of inactivity.',
    'Hosting: Supabase database, hosted in the European Union.',
    'Your rights: access, correction, deletion, objection and withdrawal of consent at any time, just ask at the counter or by email. You can also contact the Belgian Data Protection Authority (dataprotectionauthority.be).',
  ].join('\n\n'),
  modules: {
    concept: true,
    booking: true,
    events: true,
    battle: true,
    stop10: true,
    wheel: false,
    kids: true,
    drinks: true,
    products: true,
    gift: true,
    invoice: true,
    instagram: true,
  },
};

// ---------------------------------------------------------------------------
// Événements récurrents. Les dates sont calculées au moment du chargement des données
// (en SQL comme en mode démo) pour être toujours dans le futur.
// isoDow : 1 lundi ... 7 dimanche. everyWeeks : périodicité. count : occurrences créées.

export interface EventTemplate {
  key: string;
  kind: EventKind;
  /** Photo de l'événement (photo:nom, voir src/assets/photos). */
  image: string | null;
  title_fr: string;
  title_en: string;
  description_fr: string;
  description_en: string;
  recurrence_fr: string;
  recurrence_en: string;
  isoDow: number;
  time: string;
  durationMin: number;
  everyWeeks: number;
  /** Décalage en semaines de la première occurrence. */
  offsetWeeks: number;
  count: number;
  capacity: number;
}

export const EVENT_TEMPLATES: EventTemplate[] = [
  {
    key: 'cut-session',
    image: 'photo:cutsession-carre-5',
    kind: 'dj',
    title_fr: 'Cut Session',
    title_en: 'Cut Session',
    description_fr: 'Soirée DJ et ambiance au salon. Les platines prennent le relais des tondeuses, on danse entre les fauteuils.',
    description_en: 'DJ night and good vibes in the shop. The decks take over from the clippers and we dance between the chairs.',
    recurrence_fr: 'Un samedi sur deux',
    recurrence_en: 'Every other Saturday',
    isoDow: 6,
    time: '21:00',
    durationMin: 240,
    everyWeeks: 2,
    offsetWeeks: 0,
    count: 4,
    capacity: 40,
  },
  {
    key: 'cut-and-talk',
    image: 'photo:cut-and-talk-carre-5',
    kind: 'talk',
    title_fr: 'Cut and Talk',
    title_en: 'Cut and Talk',
    description_fr: 'Soirée discussion autour d’un thème. Premier thème : l’intelligence artificielle. On échange, on débat, on refait le monde.',
    description_en: 'Talk night around a theme. First theme: artificial intelligence. We share, we debate, we put the world to rights.',
    recurrence_fr: 'Le vendredi',
    recurrence_en: 'On Fridays',
    isoDow: 5,
    time: '20:30',
    durationMin: 120,
    everyWeeks: 1,
    offsetWeeks: 0,
    count: 6,
    capacity: 20,
  },
  {
    key: 'chut',
    image: 'photo:chut-carre-5',
    kind: 'read',
    title_fr: 'Chut',
    title_en: 'Chut',
    description_fr: 'Soirée lecture silencieuse avec DJ relax, un verre et un moment d’échange. Apporte ton livre, on s’occupe du reste.',
    description_en: 'Silent reading night with a chill DJ, a drink and a moment to share. Bring your book, we take care of the rest.',
    recurrence_fr: 'Un vendredi sur deux',
    recurrence_en: 'Every other Friday',
    isoDow: 5,
    time: '18:30',
    durationMin: 90,
    everyWeeks: 2,
    offsetWeeks: 1,
    count: 4,
    capacity: 15,
  },
  {
    key: 'open-mic',
    image: 'photo:open-mic-carre-1',
    kind: 'mic',
    title_fr: 'Open Mic',
    title_en: 'Open Mic',
    description_fr: 'Scène ouverte : stand up, impro, beatbox. Tu montes sur scène ou tu encourages, à toi de voir.',
    description_en: 'Open stage: stand up, improv, beatbox. Jump on stage or cheer from the crowd, your call.',
    recurrence_fr: 'Le samedi',
    recurrence_en: 'On Saturdays',
    isoDow: 6,
    time: '18:00',
    durationMin: 150,
    everyWeeks: 1,
    offsetWeeks: 0,
    count: 6,
    capacity: 40,
  },
  {
    key: 'cut-and-run',
    image: null,
    kind: 'run',
    title_fr: 'Cut and Run',
    title_en: 'Cut and Run',
    description_fr: 'Course en groupe au départ du salon, tous niveaux. On court ensemble, on termine autour d’un verre.',
    description_en: 'Group run starting from the shop, all levels welcome. We run together and finish with a drink.',
    recurrence_fr: '+/ tous les deux mois',
    recurrence_en: '+/ every two months',
    isoDow: 7,
    time: '10:00',
    durationMin: 90,
    everyWeeks: 9,
    offsetWeeks: 2,
    count: 2,
    capacity: 25,
  },
];

/** Convertit une heure locale de Bruxelles en instant ISO (gère l'heure d'été). */
export function brusselsToIso(year: number, month: number, day: number, hh: number, mm: number): string {
  const guess = Date.UTC(year, month - 1, day, hh, mm);
  const offsetAt = (ts: number) => {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Brussels',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ts));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute')) - ts;
  };
  const off = offsetAt(guess);
  const ts = guess - off;
  // Deuxième passe pour les changements d'heure.
  return new Date(guess - offsetAt(ts)).toISOString();
}

/** Calcule les occurrences des événements récurrents à partir d'aujourd'hui (même règle qu'en SQL). */
export function buildSeedEvents(today: Date = new Date()): CutEvent[] {
  const out: CutEvent[] = [];
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Brussels',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(today);
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const base = new Date(Date.UTC(g('year'), g('month') - 1, g('day')));
  const todayDow = ((base.getUTCDay() + 6) % 7) + 1;
  for (const tpl of EVENT_TEMPLATES) {
    // Première occurrence strictement après aujourd'hui.
    const firstOffset = ((tpl.isoDow - todayDow + 6) % 7) + 1 + tpl.offsetWeeks * 7;
    for (let i = 0; i < tpl.count; i++) {
      const d = new Date(base.getTime() + (firstOffset + i * tpl.everyWeeks * 7) * 86400000);
      const [hh, mm] = tpl.time.split(':').map(Number);
      const starts = brusselsToIso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), hh, mm);
      out.push({
        id: `demo-${tpl.key}-${i + 1}`,
        kind: tpl.kind,
        title_fr: tpl.title_fr,
        title_en: tpl.title_en,
        description_fr: tpl.description_fr,
        description_en: tpl.description_en,
        recurrence_fr: tpl.recurrence_fr,
        recurrence_en: tpl.recurrence_en,
        starts_at: starts,
        ends_at: new Date(new Date(starts).getTime() + tpl.durationMin * 60000).toISOString(),
        image_url: tpl.image,
        capacity: tpl.capacity,
        published: true,
      });
    }
  }
  return out.sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

// ---------------------------------------------------------------------------
// Boissons : exemples génériques à remplacer dans l'admin.

const EX = 'Exemple à remplacer';

export const SEED_DRINKS: Drink[] = [
  { id: 'd01', category: 'beer', name: 'Blonde du terroir', brand: EX, style_fr: 'Blonde', style_en: 'Blonde ale', abv: 6.5, description_fr: 'Douce, ronde et désaltérante, avec une jolie mousse.', description_en: 'Smooth, round and refreshing, with a lovely head.', price: 3.8, image_url: null, sort: 1, active: true },
  { id: 'd02', category: 'beer', name: 'Saison fermière', brand: EX, style_fr: 'Saison', style_en: 'Saison', abv: 6.0, description_fr: 'Le style né dans les fermes du Hainaut : sèche, épicée, très rafraîchissante.', description_en: 'The style born on Hainaut farms: dry, spicy and very refreshing.', price: 4.0, image_url: null, sort: 2, active: true },
  { id: 'd03', category: 'beer', name: 'Triple d’abbaye', brand: EX, style_fr: 'Triple', style_en: 'Tripel', abv: 8.5, description_fr: 'Dorée et généreuse, notes de fruits mûrs et finale chaleureuse.', description_en: 'Golden and generous, notes of ripe fruit and a warming finish.', price: 4.5, image_url: null, sort: 3, active: true },
  { id: 'd04', category: 'beer', name: 'Brune de caractère', brand: EX, style_fr: 'Brune', style_en: 'Brown ale', abv: 7.0, description_fr: 'Malt torréfié, caramel et une pointe de chocolat.', description_en: 'Roasted malt, caramel and a hint of chocolate.', price: 4.2, image_url: null, sort: 4, active: true },
  { id: 'd05', category: 'beer', name: 'Blanche', brand: EX, style_fr: 'Bière blanche', style_en: 'Witbier', abv: 4.9, description_fr: 'Blé, coriandre et écorce d’orange. Légère et parfumée.', description_en: 'Wheat, coriander and orange peel. Light and fragrant.', price: 3.6, image_url: null, sort: 5, active: true },
  { id: 'd06', category: 'beer', name: 'Kriek', brand: EX, style_fr: 'Bière fruitée à la cerise', style_en: 'Cherry beer', abv: 4.5, description_fr: 'Acidulée et fruitée, avec de vraies cerises.', description_en: 'Tart and fruity, made with real cherries.', price: 4.0, image_url: null, sort: 6, active: true },
  { id: 'd07', category: 'beer', name: 'IPA belge', brand: EX, style_fr: 'IPA', style_en: 'IPA', abv: 6.8, description_fr: 'Houblonnée, agrumes et amertume franche.', description_en: 'Hoppy, citrusy, with a clean bitterness.', price: 4.5, image_url: null, sort: 7, active: true },
  { id: 'd11', category: 'soft', name: 'Cola', brand: EX, style_fr: 'Soda', style_en: 'Soda', abv: null, description_fr: 'Le classique, bien frais.', description_en: 'The classic, nice and cold.', price: 2.8, image_url: null, sort: 11, active: true },
  { id: 'd12', category: 'soft', name: 'Limonade artisanale', brand: EX, style_fr: 'Limonade', style_en: 'Lemonade', abv: null, description_fr: 'Citron pressé, pétillante et peu sucrée.', description_en: 'Squeezed lemon, sparkling and lightly sweetened.', price: 3.2, image_url: null, sort: 12, active: true },
  { id: 'd13', category: 'soft', name: 'Thé glacé maison', brand: EX, style_fr: 'Thé glacé', style_en: 'Iced tea', abv: null, description_fr: 'Infusé au salon, pêche et menthe.', description_en: 'Brewed in house, peach and mint.', price: 3.2, image_url: null, sort: 13, active: true },
  { id: 'd14', category: 'soft', name: 'Jus de pomme local', brand: EX, style_fr: 'Jus de fruits', style_en: 'Fruit juice', abv: null, description_fr: 'Pommes de la région, pressées à froid.', description_en: 'Local apples, cold pressed.', price: 3.0, image_url: null, sort: 14, active: true },
  { id: 'd15', category: 'soft', name: 'Eau plate ou pétillante', brand: EX, style_fr: 'Eau', style_en: 'Water', abv: null, description_fr: 'Pour rester frais pendant ta coupe.', description_en: 'To stay fresh during your cut.', price: 2.5, image_url: null, sort: 15, active: true },
  { id: 'd21', category: 'other', name: 'Café', brand: EX, style_fr: 'Expresso ou allongé', style_en: 'Espresso or long', abv: null, description_fr: 'Le petit coup de boost avant la coupe.', description_en: 'The little boost before your cut.', price: 2.5, image_url: null, sort: 21, active: true },
  { id: 'd22', category: 'other', name: 'Thé chaud', brand: EX, style_fr: 'Thé ou infusion', style_en: 'Tea or herbal tea', abv: null, description_fr: 'Une sélection de thés et d’infusions.', description_en: 'A selection of teas and herbal teas.', price: 2.8, image_url: null, sort: 22, active: true },
  { id: 'd23', category: 'other', name: 'Bière sans alcool', brand: EX, style_fr: 'Blonde 0,0 %', style_en: 'Blonde 0.0%', abv: 0, description_fr: 'Tout le goût, sans l’alcool.', description_en: 'All the taste, none of the alcohol.', price: 3.5, image_url: null, sort: 23, active: true },
];

export const SEED_PAIRINGS: Pairing[] = [
  { id: 'p1', cut_fr: 'Dégradé net', cut_en: 'Sharp fade', drink_fr: 'Une blonde du terroir', drink_en: 'A local blonde', line_fr: 'Net, frais, sans bavure. Comme ton dégradé.', line_en: 'Sharp, fresh, no rough edges. Just like your fade.', sort: 1, active: true },
  { id: 'p2', cut_fr: 'Barbe taillée', cut_en: 'Trimmed beard', drink_fr: 'Une brune de caractère', drink_en: 'A bold brown ale', line_fr: 'Une barbe de caractère mérite une bière qui en a aussi.', line_en: 'A beard with character deserves a beer with character.', sort: 2, active: true },
  { id: 'p3', cut_fr: 'Coupe classique', cut_en: 'Classic cut', drink_fr: 'Une triple d’abbaye', drink_en: 'An abbey tripel', line_fr: 'Les classiques ne se démodent jamais. Ni la coupe, ni la triple.', line_en: 'Classics never go out of style. Neither the cut nor the tripel.', sort: 3, active: true },
  { id: 'p4', cut_fr: 'Boule à zéro', cut_en: 'Buzz cut', drink_fr: 'Une blanche', drink_en: 'A witbier', line_fr: 'Tête légère, bière légère, esprit libre.', line_en: 'Light head, light beer, free mind.', sort: 4, active: true },
  { id: 'p5', cut_fr: 'Boucles assumées', cut_en: 'Proud curls', drink_fr: 'Une kriek', drink_en: 'A kriek', line_fr: 'Du volume, du peps et un brin de folie fruitée.', line_en: 'Volume, pep and a touch of fruity madness.', sort: 5, active: true },
  { id: 'p6', cut_fr: 'Rasage à l’ancienne', cut_en: 'Old school shave', drink_fr: 'Une saison fermière', drink_en: 'A farmhouse saison', line_fr: 'Un rituel de tradition appelle une bière de tradition.', line_en: 'A traditional ritual calls for a traditional beer.', sort: 6, active: true },
];

// ---------------------------------------------------------------------------
// Produits : catalogue d'exemple avec étiquettes de correspondance.

const PB = 'Marque premium (exemple)';
const NM = 'Nishman';

// Gamme coiffage et barbe Nishman, plus trois soins génériques pour les profils cuir chevelu.
// Prix à 0 : non affichés tant qu'ils ne sont pas renseignés dans l'admin.
export const SEED_PRODUCTS: Product[] = [
  { id: 'pr01', name: '01 Bubble Gum', brand: NM, benefit_fr: 'Cire à base d’eau au parfum bubble gum : brillance et coiffage facile, se rince sans effort.', benefit_en: 'Water based wax with a bubble gum scent: shine and easy styling, rinses out effortlessly.', usage_fr: 'Une noisette sur cheveux secs ou légèrement humides, coiffer au peigne ou avec les doigts.', usage_en: 'A small amount on dry or slightly damp hair, style with a comb or your fingers.', price: 0, image_url: null, hair_types: ['fine', 'thick'], scalp_types: [], for_beard: false, effects: ['shine', 'hold'], sort: 1, active: true },
  { id: 'pr02', name: '03 Flaming', brand: NM, benefit_fr: 'Pommade crémeuse et gélifiée au parfum de pastèque : tenue moyenne à forte avec un fini brillant.', benefit_en: 'Creamy, gel like pomade with a watermelon scent: medium to strong hold with a shiny finish.', usage_fr: 'Répartir dans les cheveux secs, travailler la forme au peigne.', usage_en: 'Spread through dry hair, shape with a comb.', price: 0, image_url: null, hair_types: ['thick', 'curly'], scalp_types: [], for_beard: false, effects: ['shine', 'hold'], sort: 2, active: true },
  { id: 'pr03', name: '04 Rugby Tropical Mango', brand: NM, benefit_fr: 'Cire à l’eau à forte tenue, idéale pour les cheveux courts à mi longs.', benefit_en: 'Strong hold water based wax, ideal for short to medium length hair.', usage_fr: 'Chauffer entre les mains, appliquer sur cheveux secs puis coiffer.', usage_en: 'Warm between your hands, apply to dry hair, then style.', price: 0, image_url: null, hair_types: ['fine', 'thick'], scalp_types: [], for_beard: false, effects: ['hold', 'shine'], sort: 3, active: true },
  { id: 'pr04', name: '08 Matte Look', brand: NM, benefit_fr: 'Cire au fini mat, parfum vanille : un style naturel qui tient toute la journée.', benefit_en: 'Matte finish wax with a vanilla scent: a natural look that lasts all day.', usage_fr: 'Une petite quantité sur cheveux secs, travailler du bout des doigts pour texturer.', usage_en: 'A small amount on dry hair, work in with your fingertips to add texture.', price: 0, image_url: null, hair_types: ['fine', 'thick'], scalp_types: [], for_beard: false, effects: ['natural', 'hold'], sort: 4, active: true },
  { id: 'pr05', name: 'M5 Pâte coiffante mate', brand: NM, benefit_fr: 'Pâte à texture mate et fixation forte, pensée pour les coiffures créatives.', benefit_en: 'Matte texture paste with strong hold, made for creative styles.', usage_fr: 'Émulsionner entre les paumes, appliquer sur cheveux secs et sculpter.', usage_en: 'Rub between your palms, apply to dry hair and sculpt.', price: 0, image_url: null, hair_types: ['thick', 'curly'], scalp_types: [], for_beard: false, effects: ['hold', 'natural'], sort: 5, active: true },
  { id: 'pr06', name: 'M1 Argan', brand: NM, benefit_fr: 'Pâte matifiante enrichie à l’huile d’argan : fini mat et cheveux nourris.', benefit_en: 'Mattifying paste enriched with argan oil: matte finish and nourished hair.', usage_fr: 'Appliquer sur cheveux secs, coiffer avec les doigts pour un effet naturel.', usage_en: 'Apply to dry hair, style with your fingers for a natural effect.', price: 0, image_url: null, hair_types: ['fine', 'thick', 'curly'], scalp_types: [], for_beard: false, effects: ['natural', 'care'], sort: 6, active: true },
  { id: 'pr07', name: 'P0 Light Control', brand: NM, benefit_fr: 'Poudre coiffante légère : volume instantané et fini mat, idéale pour les cheveux fins.', benefit_en: 'Light styling powder: instant volume and matte finish, ideal for fine hair.', usage_fr: 'Saupoudrer sur les racines sèches, puis travailler du bout des doigts.', usage_en: 'Sprinkle on dry roots, then work in with your fingertips.', price: 0, image_url: null, hair_types: ['fine'], scalp_types: [], for_beard: false, effects: ['volume', 'natural'], sort: 7, active: true },
  { id: 'pr08', name: 'S1 Spider Wax', brand: NM, benefit_fr: 'Cire fibreuse pour des mèches texturées et du volume, avec une tenue souple.', benefit_en: 'Fibrous wax for textured strands and volume, with a flexible hold.', usage_fr: 'Étirer la cire entre les doigts, appliquer mèche par mèche.', usage_en: 'Stretch the wax between your fingers, apply strand by strand.', price: 0, image_url: null, hair_types: ['fine', 'thick'], scalp_types: [], for_beard: false, effects: ['volume', 'hold'], sort: 8, active: true },
  { id: 'pr09', name: 'Cire barbe et moustache', brand: NM, benefit_fr: 'Discipline la barbe et sculpte la moustache, pour un contour net toute la journée.', benefit_en: 'Tames the beard and shapes the moustache for a sharp outline all day.', usage_fr: 'Chauffer une petite quantité entre les doigts, appliquer puis brosser ou peigner.', usage_en: 'Warm a small amount between your fingers, apply, then brush or comb.', price: 0, image_url: null, hair_types: [], scalp_types: [], for_beard: true, effects: ['hold', 'care'], sort: 9, active: true },
  { id: 'pr10', name: 'Shampoing doux quotidien (exemple)', brand: PB, benefit_fr: 'Nettoie en douceur sans dessécher, pour un usage de tous les jours.', benefit_en: 'Gently cleanses without drying, for everyday use.', usage_fr: 'Masser sur cheveux mouillés, rincer abondamment.', usage_en: 'Massage into wet hair, rinse thoroughly.', price: 0, image_url: null, hair_types: [], scalp_types: ['normal'], for_beard: false, effects: ['natural', 'care'], sort: 10, active: true },
  { id: 'pr11', name: 'Shampoing purifiant (exemple)', brand: PB, benefit_fr: 'Régule l’excès de sébum et apporte une sensation de fraîcheur durable.', benefit_en: 'Balances excess sebum and leaves a lasting fresh feeling.', usage_fr: 'Deux à trois fois par semaine, laisser poser une minute avant de rincer.', usage_en: 'Two to three times a week, leave on for one minute before rinsing.', price: 0, image_url: null, hair_types: [], scalp_types: ['oily'], for_beard: false, effects: ['volume', 'natural', 'care'], sort: 11, active: true },
  { id: 'pr12', name: 'Shampoing hydratant intense (exemple)', brand: PB, benefit_fr: 'Nourrit en profondeur et apaise le cuir chevelu sec.', benefit_en: 'Deeply nourishes and soothes a dry scalp.', usage_fr: 'Appliquer sur cheveux mouillés, masser, rincer à l’eau tiède.', usage_en: 'Apply to wet hair, massage, rinse with lukewarm water.', price: 0, image_url: null, hair_types: [], scalp_types: ['dry'], for_beard: false, effects: ['care', 'shine'], sort: 12, active: true },
];

// ---------------------------------------------------------------------------
// Roue de la fortune.

export const SEED_PRIZES: WheelPrize[] = [
  { id: 'w1', label_fr: '10 % sur ta coupe', label_en: '10% off your cut', weight: 10, stock: null, is_losing: false, color: '#D4A84B', sort: 1, active: true },
  { id: 'w2', label_fr: 'Un soft offert', label_en: 'A free soft drink', weight: 25, stock: null, is_losing: false, color: '#267255', sort: 2, active: true },
  { id: 'w3', label_fr: 'Une bière offerte', label_en: 'A free beer', weight: 15, stock: null, is_losing: false, color: '#F4EBD9', sort: 3, active: true },
  { id: 'w4', label_fr: '5 € sur un produit', label_en: '€5 off a product', weight: 10, stock: null, is_losing: false, color: '#8F6B22', sort: 4, active: true },
  { id: 'w5', label_fr: 'Pas de chance cette fois', label_en: 'No luck this time', weight: 40, stock: null, is_losing: true, color: '#0E2F23', sort: 5, active: true },
];

// ---------------------------------------------------------------------------
// Quiz : 90 questions. La première proposition est toujours la bonne réponse
// (correct_index 0) ; l'ordre est mélangé au moment de jouer.

type QA = [string, [string, string, string, string]];

function q(theme: QuizTheme, n: number, fr: QA, en: QA): QuizQuestion {
  return {
    id: `q-${theme}-${String(n).padStart(2, '0')}`,
    theme,
    question_fr: fr[0],
    question_en: en[0],
    answers_fr: [...fr[1]],
    answers_en: [...en[1]],
    correct_index: 0,
    active: true,
  };
}

export const SEED_QUESTIONS: QuizQuestion[] = [
  // Mons et son folklore
  q('mons', 1,
    ['Comment s’appelle la grande fête de Mons, le week end de la Trinité ?', ['Le Doudou', 'Le Carnaval', 'La Ducasse d’Ath', 'Les Fêtes de Wallonie']],
    ['What is the name of the big Mons festival held on Trinity weekend?', ['The Doudou', 'The Carnival', 'The Ath Ducasse', 'The Wallonia Festival']]),
  q('mons', 2,
    ['Qui affronte le Dragon pendant le Combat dit Lumeçon ?', ['Saint Georges', 'Saint Michel', 'Saint Nicolas', 'Saint Martin']],
    ['Who fights the Dragon during the Lumeçon battle?', ['Saint George', 'Saint Michael', 'Saint Nicholas', 'Saint Martin']]),
  q('mons', 3,
    ['Sur la Grand Place, on caresse la tête de quel animal pour avoir de la chance ?', ['Un petit singe', 'Un lion', 'Un chien', 'Un dragon']],
    ['On the Grand Place, which animal’s head do people stroke for good luck?', ['A little monkey', 'A lion', 'A dog', 'A dragon']]),
  q('mons', 4,
    ['Mons a été Capitale européenne de la culture en quelle année ?', ['2015', '2010', '2018', '2005']],
    ['In which year was Mons a European Capital of Culture?', ['2015', '2010', '2018', '2005']]),
  q('mons', 5,
    ['Le beffroi de Mons est le seul beffroi de Belgique de quel style ?', ['Baroque', 'Gothique', 'Roman', 'Art déco']],
    ['The Mons belfry is the only belfry in Belgium built in which style?', ['Baroque', 'Gothic', 'Romanesque', 'Art Deco']]),
  q('mons', 6,
    ['Quelle sainte est la patronne de Mons ?', ['Sainte Waudru', 'Sainte Gudule', 'Sainte Catherine', 'Sainte Rita']],
    ['Which saint is the patron saint of Mons?', ['Saint Waudru', 'Saint Gudula', 'Saint Catherine', 'Saint Rita']]),
  q('mons', 7,
    ['Comment s’appelle le char doré qui porte la châsse de Sainte Waudru pendant la procession ?', ['Le Car d’Or', 'Le Char du Roi', 'Le Carrosse des Saints', 'La Barque dorée']],
    ['What is the golden chariot carrying Saint Waudru’s shrine during the procession called?', ['The Car d’Or', 'The King’s Chariot', 'The Saints’ Coach', 'The Golden Barge']]),
  q('mons', 8,
    ['Quelle rivière traverse Mons ?', ['La Trouille', 'La Meuse', 'L’Escaut', 'La Sambre']],
    ['Which river flows through Mons?', ['The Trouille', 'The Meuse', 'The Scheldt', 'The Sambre']]),
  q('mons', 9,
    ['Mons est la capitale de quelle province ?', ['Le Hainaut', 'Namur', 'Liège', 'Le Brabant wallon']],
    ['Mons is the capital of which province?', ['Hainaut', 'Namur', 'Liège', 'Walloon Brabant']]),
  q('mons', 10,
    ['Comment s’appellent les habitants de Mons ?', ['Les Montois', 'Les Monsiens', 'Les Montagnards', 'Les Monsois']],
    ['What are the people of Mons called?', ['Montois', 'Monsians', 'Mountaineers', 'Monsois']]),
  q('mons', 11,
    ['Quel peintre célèbre a vécu dans le Borinage, près de Mons, avant de devenir artiste ?', ['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet', 'Paul Cézanne']],
    ['Which famous painter lived in the Borinage, near Mons, before becoming an artist?', ['Vincent van Gogh', 'Pablo Picasso', 'Claude Monet', 'Paul Cézanne']]),
  q('mons', 12,
    ['Le Mundaneum, installé à Mons, est souvent surnommé...', ['Le Google de papier', 'Le Louvre belge', 'La Bibliothèque du roi', 'Le Musée du temps']],
    ['The Mundaneum, based in Mons, is often nicknamed...', ['The paper Google', 'The Belgian Louvre', 'The King’s Library', 'The Museum of Time']]),
  q('mons', 13,
    ['Pendant le Lumeçon, la foule essaie d’attraper quoi sur le Dragon pour avoir de la chance ?', ['Les crins de sa queue', 'Ses écailles', 'Ses dents', 'Ses ailes']],
    ['During the Lumeçon, what does the crowd try to grab from the Dragon for good luck?', ['Hair from its tail', 'Its scales', 'Its teeth', 'Its wings']]),
  q('mons', 14,
    ['Comment s’appellent les personnages qui protègent Saint Georges pendant le Lumeçon ?', ['Les Chinchins', 'Les Gilles', 'Les Blancs Moussis', 'Les Géants']],
    ['What are the characters protecting Saint George during the Lumeçon called?', ['The Chinchins', 'The Gilles', 'The Blancs Moussis', 'The Giants']]),
  q('mons', 15,
    ['Quel est le nom de Mons en néerlandais ?', ['Bergen', 'Monten', 'Berghe', 'Heuvel']],
    ['What is the Dutch name of Mons?', ['Bergen', 'Monten', 'Berghe', 'Heuvel']]),

  // Bières belges
  q('beer', 1,
    ['Laquelle de ces bières est une trappiste ?', ['Chimay', 'Leffe', 'Duvel', 'Jupiler']],
    ['Which of these beers is a Trappist beer?', ['Chimay', 'Leffe', 'Duvel', 'Jupiler']]),
  q('beer', 2,
    ['La Chimay est brassée dans quelle province ?', ['Le Hainaut', 'Liège', 'Namur', 'Le Luxembourg']],
    ['Chimay is brewed in which province?', ['Hainaut', 'Liège', 'Namur', 'Luxembourg']]),
  q('beer', 3,
    ['Quel animal figure sur le logo de l’Orval ?', ['Une truite', 'Un cygne', 'Un lion', 'Un cerf']],
    ['Which animal appears on the Orval logo?', ['A trout', 'A swan', 'A lion', 'A deer']]),
  q('beer', 4,
    ['La culture de la bière en Belgique est inscrite au patrimoine de l’UNESCO depuis quelle année ?', ['2016', '2006', '2012', '2020']],
    ['Since which year has Belgian beer culture been on the UNESCO heritage list?', ['2016', '2006', '2012', '2020']]),
  q('beer', 5,
    ['Quel type de fermentation donne naissance au lambic ?', ['Spontanée', 'Basse', 'Haute', 'Accélérée']],
    ['What kind of fermentation produces lambic?', ['Spontaneous', 'Bottom', 'Top', 'Accelerated']]),
  q('beer', 6,
    ['La gueuze est un assemblage de...', ['Lambics jeunes et vieux', 'Bières blondes et brunes', 'Bière et cidre', 'Bière et vin']],
    ['Gueuze is a blend of...', ['Young and old lambics', 'Blonde and brown beers', 'Beer and cider', 'Beer and wine']]),
  q('beer', 7,
    ['Quel fruit donne son goût à la kriek ?', ['La cerise', 'La framboise', 'La pêche', 'La pomme']],
    ['Which fruit gives kriek its flavour?', ['Cherry', 'Raspberry', 'Peach', 'Apple']]),
  q('beer', 8,
    ['La bière de saison est née dans les fermes de quelle région ?', ['Le Hainaut', 'La Flandre occidentale', 'Le Limbourg', 'Anvers']],
    ['Saison beer was born on the farms of which region?', ['Hainaut', 'West Flanders', 'Limburg', 'Antwerp']]),
  q('beer', 9,
    ['Que veut dire le mot Duvel ?', ['Diable', 'Ange', 'Double', 'Doré']],
    ['What does the word Duvel mean?', ['Devil', 'Angel', 'Double', 'Golden']]),
  q('beer', 10,
    ['Quelle céréale est la plus utilisée pour fabriquer le malt ?', ['L’orge', 'Le maïs', 'Le riz', 'L’avoine']],
    ['Which grain is most commonly used to make malt?', ['Barley', 'Corn', 'Rice', 'Oats']]),
  q('beer', 11,
    ['Quelle plante apporte l’amertume à la bière ?', ['Le houblon', 'La lavande', 'La menthe', 'Le thym']],
    ['Which plant gives beer its bitterness?', ['Hops', 'Lavender', 'Mint', 'Thyme']]),
  q('beer', 12,
    ['Une bière blanche belge est brassée avec du blé et souvent avec...', ['De la coriandre et de l’écorce d’orange', 'De la cannelle et de la vanille', 'Du gingembre et du citron vert', 'Du poivre et du thym']],
    ['A Belgian witbier is brewed with wheat and often with...', ['Coriander and orange peel', 'Cinnamon and vanilla', 'Ginger and lime', 'Pepper and thyme']]),
  q('beer', 13,
    ['Le célèbre verre Kwak est tenu par...', ['Un support en bois', 'Une anse en cuir', 'Une chaîne en métal', 'Un socle en pierre']],
    ['The famous Kwak glass is held by...', ['A wooden stand', 'A leather handle', 'A metal chain', 'A stone base']]),
  q('beer', 14,
    ['La Jupiler tire son nom de quel endroit ?', ['Jupille, près de Liège', 'La planète Jupiter', 'Jumet, près de Charleroi', 'Jodoigne']],
    ['Jupiler takes its name from which place?', ['Jupille, near Liège', 'The planet Jupiter', 'Jumet, near Charleroi', 'Jodoigne']]),
  q('beer', 15,
    ['Le faro est un lambic adouci avec...', ['Du sucre', 'Du miel', 'Du sel', 'Du lait']],
    ['Faro is a lambic sweetened with...', ['Sugar', 'Honey', 'Salt', 'Milk']]),

  // Culture barber
  q('barber', 1,
    ['D’où vient l’enseigne rouge et blanche des barbiers ?', ['Des barbiers chirurgiens d’autrefois', 'D’un club de football', 'D’un drapeau de marins', 'D’une marque de bonbons']],
    ['Where does the red and white barber pole come from?', ['The barber surgeons of the past', 'A football club', 'A sailors’ flag', 'A candy brand']]),
  q('barber', 2,
    ['Comment s’appelle une coupe qui passe progressivement de très court à plus long ?', ['Un dégradé', 'Un carré', 'Un chignon', 'Une frange']],
    ['What do you call a cut that goes gradually from very short to longer?', ['A fade', 'A bob', 'A bun', 'A fringe']]),
  q('barber', 3,
    ['Quel est le surnom du rasoir droit traditionnel ?', ['Le coupe chou', 'Le coupe vent', 'Le taille haie', 'Le coupe papier']],
    ['What is the traditional straight razor also called?', ['A cutthroat razor', 'A safety pin', 'A hedge trimmer', 'A paper cutter']]),
  q('barber', 4,
    ['Le blaireau de rasage était traditionnellement fabriqué avec les poils de quel animal ?', ['Le blaireau', 'Le chat', 'Le lapin', 'Le mouton']],
    ['Shaving brushes were traditionally made with the hair of which animal?', ['The badger', 'The cat', 'The rabbit', 'The sheep']]),
  q('barber', 5,
    ['Une moustache aux pointes relevées s’appelle une moustache...', ['En guidon', 'En brosse', 'En crayon', 'En fer à cheval']],
    ['A moustache with upturned tips is called a... moustache', ['Handlebar', 'Toothbrush', 'Pencil', 'Horseshoe']]),
  q('barber', 6,
    ['À quoi sert la serviette chaude avant un rasage traditionnel ?', ['À ramollir le poil et détendre la peau', 'À sécher la barbe', 'À colorer la peau', 'À couper le poil']],
    ['What is the hot towel for before a traditional shave?', ['Softening the hair and relaxing the skin', 'Drying the beard', 'Colouring the skin', 'Cutting the hair']]),
  q('barber', 7,
    ['Quel est le surnom de la coupe mulet ?', ['La nuque longue', 'La boule à zéro', 'La coupe au bol', 'La crête']],
    ['What is the famous motto of the mullet?', ['Business in the front, party in the back', 'Short and sweet', 'Less is more', 'Keep it clean']]),
  q('barber', 8,
    ['La coupe banane popularisée par Elvis Presley porte aussi le nom de...', ['Pompadour', 'Mohawk', 'Undercut', 'Buzz cut']],
    ['The quiff popularised by Elvis Presley is also called a...', ['Pompadour', 'Mohawk', 'Undercut', 'Buzz cut']]),
  q('barber', 9,
    ['En moyenne, les cheveux poussent de combien par mois ?', ['+/ 1 cm', '+/ 1 mm', '+/ 5 cm', '+/ 10 cm']],
    ['On average, how much does hair grow per month?', ['+/ 1 cm', '+/ 1 mm', '+/ 5 cm', '+/ 10 cm']]),
  q('barber', 10,
    ['Quel produit coiffant donne un effet mat et naturel ?', ['L’argile', 'La pommade brillante', 'Le gel effet mouillé', 'La laque brillante']],
    ['Which styling product gives a matte, natural finish?', ['Clay', 'Shiny pomade', 'Wet look gel', 'Shiny hairspray']]),
  q('barber', 11,
    ['Le sabot numéro 1 d’une tondeuse laisse environ...', ['+/ 3 mm', '+/ 1 cm', '+/ 2 cm', '+/ 5 cm']],
    ['A number 1 clipper guard leaves about...', ['+/ 3 mm', '+/ 1 cm', '+/ 2 cm', '+/ 5 cm']]),
  q('barber', 12,
    ['À quoi sert l’huile à barbe ?', ['À nourrir la barbe et la peau', 'À faire pousser la barbe deux fois plus vite', 'À teindre la barbe en noir', 'À remplacer le savon']],
    ['What is beard oil for?', ['Nourishing the beard and the skin', 'Making the beard grow twice as fast', 'Dyeing the beard black', 'Replacing soap']]),
  q('barber', 13,
    ['Rossini a composé un opéra célèbre sur un barbier. Lequel ?', ['Le Barbier de Séville', 'La Flûte enchantée', 'Carmen', 'La Traviata']],
    ['Rossini wrote a famous opera about a barber. Which one?', ['The Barber of Seville', 'The Magic Flute', 'Carmen', 'La Traviata']]),
  q('barber', 14,
    ['Comment s’appelle la coupe où les côtés sont très courts et le dessus reste long ?', ['L’undercut', 'Le carré plongeant', 'La coupe au bol', 'Le chignon']],
    ['What is the cut with very short sides and a long top called?', ['The undercut', 'The inverted bob', 'The bowl cut', 'The bun']]),
  q('barber', 15,
    ['Un quatuor barbershop, c’est...', ['Quatre chanteurs a cappella', 'Quatre barbiers qui coupent en même temps', 'Un groupe de rock', 'Une danse de salon']],
    ['A barbershop quartet is...', ['Four singers performing a cappella', 'Four barbers cutting at the same time', 'A rock band', 'A ballroom dance']]),

  // Musique
  q('music', 1,
    ['De quelle ville est originaire le chanteur Stromae ?', ['Bruxelles', 'Liège', 'Paris', 'Charleroi']],
    ['Which city does the singer Stromae come from?', ['Brussels', 'Liège', 'Paris', 'Charleroi']]),
  q('music', 2,
    ['Qui chante « Alors on danse » ?', ['Stromae', 'Angèle', 'Damso', 'Lost Frequencies']],
    ['Who sings “Alors on danse”?', ['Stromae', 'Angèle', 'Damso', 'Lost Frequencies']]),
  q('music', 3,
    ['Adolphe Sax, l’inventeur du saxophone, est né dans quelle ville belge ?', ['Dinant', 'Namur', 'Mons', 'Gand']],
    ['Adolphe Sax, the inventor of the saxophone, was born in which Belgian town?', ['Dinant', 'Namur', 'Mons', 'Ghent']]),
  q('music', 4,
    ['Jacques Brel, qui chante « Ne me quitte pas », était...', ['Belge', 'Français', 'Suisse', 'Canadien']],
    ['Jacques Brel, who sang “Ne me quitte pas”, was...', ['Belgian', 'French', 'Swiss', 'Canadian']]),
  q('music', 5,
    ['Dans quelle commune a lieu le festival Tomorrowland ?', ['Boom', 'Dour', 'Werchter', 'Spa']],
    ['In which town does the Tomorrowland festival take place?', ['Boom', 'Dour', 'Werchter', 'Spa']]),
  q('music', 6,
    ['Le Dour Festival se déroule dans quelle province ?', ['Le Hainaut', 'Liège', 'Anvers', 'Namur']],
    ['Dour Festival takes place in which province?', ['Hainaut', 'Liège', 'Antwerp', 'Namur']]),
  q('music', 7,
    ['Quelle chanteuse belge a sorti « Balance ton quoi » ?', ['Angèle', 'Typh Barrow', 'Selah Sue', 'Lous and the Yakuza']],
    ['Which Belgian singer released “Balance ton quoi”?', ['Angèle', 'Typh Barrow', 'Selah Sue', 'Lous and the Yakuza']]),
  q('music', 8,
    ['Le hip hop est né dans les années 1970 dans quel quartier ?', ['Le Bronx, à New York', 'Hollywood, à Los Angeles', 'Soho, à Londres', 'Montmartre, à Paris']],
    ['Hip hop was born in the 1970s in which neighbourhood?', ['The Bronx, New York', 'Hollywood, Los Angeles', 'Soho, London', 'Montmartre, Paris']]),
  q('music', 9,
    ['Combien de touches compte un piano classique ?', ['88', '64', '76', '100']],
    ['How many keys does a standard piano have?', ['88', '64', '76', '100']]),
  q('music', 10,
    ['De quel pays vient le reggae ?', ['La Jamaïque', 'Le Brésil', 'Cuba', 'Le Nigeria']],
    ['Which country does reggae come from?', ['Jamaica', 'Brazil', 'Cuba', 'Nigeria']]),
  q('music', 11,
    ['Qui est surnommé le roi de la pop ?', ['Michael Jackson', 'Elvis Presley', 'Prince', 'Freddie Mercury']],
    ['Who is nicknamed the King of Pop?', ['Michael Jackson', 'Elvis Presley', 'Prince', 'Freddie Mercury']]),
  q('music', 12,
    ['Quel titre a été chanté par le groupe Queen ?', ['Bohemian Rhapsody', 'Billie Jean', 'Imagine', 'Hey Jude']],
    ['Which song was performed by the band Queen?', ['Bohemian Rhapsody', 'Billie Jean', 'Imagine', 'Hey Jude']]),
  q('music', 13,
    ['De quel pays vient le duo Daft Punk ?', ['La France', 'La Belgique', 'L’Allemagne', 'La Suède']],
    ['Which country is the duo Daft Punk from?', ['France', 'Belgium', 'Germany', 'Sweden']]),
  q('music', 14,
    ['Quel tube a chanté le Belge Plastic Bertrand ?', ['Ça plane pour moi', 'Alors on danse', 'Tous les mêmes', 'Dernière danse']],
    ['Which hit was sung by the Belgian artist Plastic Bertrand?', ['Ça plane pour moi', 'Alors on danse', 'Tous les mêmes', 'Dernière danse']]),
  q('music', 15,
    ['Le DJ belge Lost Frequencies s’est fait connaître avec quel titre ?', ['Are You With Me', 'Titanium', 'Wake Me Up', 'Lean On']],
    ['Belgian DJ Lost Frequencies broke through with which track?', ['Are You With Me', 'Titanium', 'Wake Me Up', 'Lean On']]),

  // Culture générale
  q('general', 1,
    ['Combien de langues officielles compte la Belgique ?', ['3', '2', '4', '1']],
    ['How many official languages does Belgium have?', ['3', '2', '4', '1']]),
  q('general', 2,
    ['Quel personnage de BD a été créé par Hergé ?', ['Tintin', 'Astérix', 'Lucky Luke', 'Gaston Lagaffe']],
    ['Which comic character was created by Hergé?', ['Tintin', 'Asterix', 'Lucky Luke', 'Gaston']]),
  q('general', 3,
    ['L’Atomium a été construit pour l’Exposition universelle de quelle année ?', ['1958', '1935', '1970', '2000']],
    ['The Atomium was built for the World’s Fair of which year?', ['1958', '1935', '1970', '2000']]),
  q('general', 4,
    ['Quelle est la date de la fête nationale belge ?', ['Le 21 juillet', 'Le 14 juillet', 'Le 11 novembre', 'Le 1er mai']],
    ['When is Belgian National Day?', ['21 July', '14 July', '11 November', '1 May']]),
  q('general', 5,
    ['Que signifie l’abréviation IA ?', ['Intelligence artificielle', 'Internet avancé', 'Information automatique', 'Image animée']],
    ['What does AI stand for?', ['Artificial intelligence', 'Advanced internet', 'Automatic information', 'Animated image']]),
  q('general', 6,
    ['Quel scientifique a imaginé un test célèbre pour savoir si une machine peut penser ?', ['Alan Turing', 'Albert Einstein', 'Isaac Newton', 'Marie Curie']],
    ['Which scientist came up with a famous test to tell whether a machine can think?', ['Alan Turing', 'Albert Einstein', 'Isaac Newton', 'Marie Curie']]),
  q('general', 7,
    ['Quelle planète est surnommée la planète rouge ?', ['Mars', 'Vénus', 'Jupiter', 'Saturne']],
    ['Which planet is nicknamed the red planet?', ['Mars', 'Venus', 'Jupiter', 'Saturn']]),
  q('general', 8,
    ['Quel est le plus grand océan du monde ?', ['Le Pacifique', 'L’Atlantique', 'L’océan Indien', 'L’Arctique']],
    ['What is the largest ocean in the world?', ['The Pacific', 'The Atlantic', 'The Indian Ocean', 'The Arctic']]),
  q('general', 9,
    ['Combien de fois le Belge Eddy Merckx a remporté le Tour de France ?', ['5', '3', '7', '2']],
    ['How many times did Belgian cyclist Eddy Merckx win the Tour de France?', ['5', '3', '7', '2']]),
  q('general', 10,
    ['En quelle année a eu lieu la bataille de Waterloo ?', ['1815', '1789', '1830', '1914']],
    ['In which year did the Battle of Waterloo take place?', ['1815', '1789', '1830', '1914']]),
  q('general', 11,
    ['Quelle est la formule chimique de l’eau ?', ['H2O', 'CO2', 'O2', 'NaCl']],
    ['What is the chemical formula of water?', ['H2O', 'CO2', 'O2', 'NaCl']]),
  q('general', 12,
    ['Quel dessinateur belge a créé les Schtroumpfs ?', ['Peyo', 'Hergé', 'Franquin', 'Morris']],
    ['Which Belgian cartoonist created the Smurfs?', ['Peyo', 'Hergé', 'Franquin', 'Morris']]),
  q('general', 13,
    ['Combien de provinces compte la Belgique ?', ['10', '9', '11', '12']],
    ['How many provinces does Belgium have?', ['10', '9', '11', '12']]),
  q('general', 14,
    ['Quelle ville belge est surnommée la Venise du Nord ?', ['Bruges', 'Gand', 'Anvers', 'Ostende']],
    ['Which Belgian city is nicknamed the Venice of the North?', ['Bruges', 'Ghent', 'Antwerp', 'Ostend']]),
  q('general', 15,
    ['En quelle année la Belgique est devenue indépendante ?', ['1830', '1815', '1789', '1914']],
    ['In which year did Belgium become independent?', ['1830', '1815', '1789', '1914']]),

  // Questions faciles pour les enfants
  q('kids', 1,
    ['Combien de pattes a une araignée ?', ['8', '6', '4', '10']],
    ['How many legs does a spider have?', ['8', '6', '4', '10']]),
  q('kids', 2,
    ['Bleu et jaune mélangés, ça donne quelle couleur ?', ['Vert', 'Orange', 'Violet', 'Rose']],
    ['Mix blue and yellow: which colour do you get?', ['Green', 'Orange', 'Purple', 'Pink']]),
  q('kids', 3,
    ['Comment s’appelle le chien de Tintin ?', ['Milou', 'Idéfix', 'Rantanplan', 'Pluto']],
    ['What is the name of Tintin’s dog?', ['Snowy', 'Dogmatix', 'Rin Tin Can', 'Pluto']]),
  q('kids', 4,
    ['De quelle couleur sont les Schtroumpfs ?', ['Bleus', 'Verts', 'Rouges', 'Jaunes']],
    ['What colour are the Smurfs?', ['Blue', 'Green', 'Red', 'Yellow']]),
  q('kids', 5,
    ['Une semaine compte combien de jours ?', ['7', '5', '6', '10']],
    ['How many days are there in a week?', ['7', '5', '6', '10']]),
  q('kids', 6,
    ['Quel animal fait « meuh » ?', ['La vache', 'Le mouton', 'Le cochon', 'Le canard']],
    ['Which animal says “moo”?', ['The cow', 'The sheep', 'The pig', 'The duck']]),
  q('kids', 7,
    ['Quel est l’animal le plus rapide sur terre ?', ['Le guépard', 'Le lion', 'Le cheval', 'Le lapin']],
    ['What is the fastest land animal?', ['The cheetah', 'The lion', 'The horse', 'The rabbit']]),
  q('kids', 8,
    ['Comment s’appelle le bébé de la grenouille ?', ['Le têtard', 'Le poussin', 'Le chaton', 'L’ourson']],
    ['What is a baby frog called?', ['A tadpole', 'A chick', 'A kitten', 'A cub']]),
  q('kids', 9,
    ['Combien de couleurs compte un arc en ciel ?', ['7', '5', '3', '10']],
    ['How many colours are there in a rainbow?', ['7', '5', '3', '10']]),
  q('kids', 10,
    ['Quel est le plus gros animal qui vit sur terre ?', ['L’éléphant', 'La girafe', 'Le rhinocéros', 'L’hippopotame']],
    ['What is the biggest animal living on land?', ['The elephant', 'The giraffe', 'The rhino', 'The hippo']]),
  q('kids', 11,
    ['Une heure compte combien de minutes ?', ['60', '100', '30', '24']],
    ['How many minutes are there in an hour?', ['60', '100', '30', '24']]),
  q('kids', 12,
    ['Quel oiseau ne sait pas voler ?', ['Le manchot', 'Le pigeon', 'Le moineau', 'L’aigle']],
    ['Which bird cannot fly?', ['The penguin', 'The pigeon', 'The sparrow', 'The eagle']]),
  q('kids', 13,
    ['Quel outil sert à couper les cheveux ?', ['Les ciseaux', 'La cuillère', 'Le marteau', 'Le pinceau']],
    ['Which tool is used to cut hair?', ['Scissors', 'A spoon', 'A hammer', 'A paintbrush']]),
  q('kids', 14,
    ['Combien de pattes a un insecte ?', ['6', '8', '4', '2']],
    ['How many legs does an insect have?', ['6', '8', '4', '2']]),
  q('kids', 15,
    ['Que fabriquent les abeilles ?', ['Du miel', 'Du lait', 'Du chocolat', 'De la confiture']],
    ['What do bees make?', ['Honey', 'Milk', 'Chocolate', 'Jam']]),
];
