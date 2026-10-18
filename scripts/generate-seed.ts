// Génère supabase/seed.sql à partir de src/data/seed.ts (source unique des données d'exemple).
// Usage : npm run seed

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import {
  DEFAULT_SETTINGS,
  buildSeedEvents,
  SEED_DRINKS,
  SEED_SERVICES,
  SEED_PAIRINGS,
  SEED_PRIZES,
  SEED_PRODUCTS,
  SEED_QUESTIONS,
} from '../src/data/seed';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const s = (v: string | null | undefined) => (v === null || v === undefined ? 'null' : `'${v.replace(/'/g, "''")}'`);
const n = (v: number | null) => (v === null ? 'null' : String(v));
const b = (v: boolean) => (v ? 'true' : 'false');
const arr = (v: string[]) => (v.length === 0 ? `'{}'::text[]` : `array[${v.map(s).join(', ')}]::text[]`);

const out: string[] = [];
out.push('-- Données d\'exemple Cutshop. Fichier généré par scripts/generate-seed.ts : ne pas modifier à la main.');
out.push('-- À exécuter une seule fois après la migration (SQL Editor de Supabase ou supabase db reset).');
out.push('begin;');
out.push('');
out.push('-- Réglages');
out.push(`update public.settings set data = ${s(JSON.stringify(DEFAULT_SETTINGS))}::jsonb, updated_at = now() where id = 1;`);
out.push('');

out.push('-- Programme des événements (dates fixes, heure de Bruxelles).');
for (const e of buildSeedEvents()) {
  out.push(
    `insert into public.events (kind, title_fr, title_en, description_fr, description_en, recurrence_fr, recurrence_en, image_url, starts_at, ends_at, capacity, published) values (${s(e.kind)}, ${s(e.title_fr)}, ${s(e.title_en)}, ${s(e.description_fr)}, ${s(e.description_en)}, ${s(e.recurrence_fr)}, ${s(e.recurrence_en)}, ${s(e.image_url)}, ${s(e.starts_at)}, ${s(e.ends_at)}, ${e.capacity}, true);`,
  );
}
out.push('');

out.push('-- Prestations');
for (const v of SEED_SERVICES) {
  out.push(
    `insert into public.services (category, name_fr, name_en, description_fr, description_en, duration_min, price, student_price, shampoo_included, sort, active) values (${s(v.category)}, ${s(v.name_fr)}, ${s(v.name_en)}, ${s(v.description_fr)}, ${s(v.description_en)}, ${n(v.duration_min)}, ${v.price}, ${n(v.student_price)}, ${v.shampoo_included === null ? 'null' : b(v.shampoo_included)}, ${v.sort}, ${b(v.active)});`,
  );
}
out.push('');

out.push('-- Boissons');
for (const d of SEED_DRINKS) {
  out.push(
    `insert into public.drinks (category, name, brand, style_fr, style_en, abv, description_fr, description_en, price, image_url, sort, active) values (${s(d.category)}, ${s(d.name)}, ${s(d.brand)}, ${s(d.style_fr)}, ${s(d.style_en)}, ${n(d.abv)}, ${s(d.description_fr)}, ${s(d.description_en)}, ${d.price}, ${s(d.image_url)}, ${d.sort}, ${b(d.active)});`,
  );
}
out.push('');
out.push('-- Ta coupe, ta bière');
for (const p of SEED_PAIRINGS) {
  out.push(
    `insert into public.drink_pairings (cut_fr, cut_en, drink_fr, drink_en, line_fr, line_en, sort, active) values (${s(p.cut_fr)}, ${s(p.cut_en)}, ${s(p.drink_fr)}, ${s(p.drink_en)}, ${s(p.line_fr)}, ${s(p.line_en)}, ${p.sort}, ${b(p.active)});`,
  );
}
out.push('');
out.push('-- Produits');
for (const p of SEED_PRODUCTS) {
  out.push(
    `insert into public.products (name, brand, benefit_fr, benefit_en, usage_fr, usage_en, price, hair_types, scalp_types, for_beard, effects, image_url, sort, active) values (${s(p.name)}, ${s(p.brand)}, ${s(p.benefit_fr)}, ${s(p.benefit_en)}, ${s(p.usage_fr)}, ${s(p.usage_en)}, ${p.price}, ${arr(p.hair_types)}, ${arr(p.scalp_types)}, ${b(p.for_beard)}, ${arr(p.effects)}, ${s(p.image_url)}, ${p.sort}, ${b(p.active)});`,
  );
}
out.push('');
out.push('-- Gains de la roue');
for (const w of SEED_PRIZES) {
  out.push(
    `insert into public.wheel_prizes (label_fr, label_en, weight, stock, is_losing, color, sort, active) values (${s(w.label_fr)}, ${s(w.label_en)}, ${w.weight}, ${n(w.stock)}, ${b(w.is_losing)}, ${s(w.color)}, ${w.sort}, ${b(w.active)});`,
  );
}
out.push('');
out.push(`-- Questions de quiz (${SEED_QUESTIONS.length})`);
for (const q of SEED_QUESTIONS) {
  out.push(
    `insert into public.quiz_questions (theme, question_fr, question_en, answers_fr, answers_en, correct_index, active) values (${s(q.theme)}, ${s(q.question_fr)}, ${s(q.question_en)}, ${arr(q.answers_fr)}, ${arr(q.answers_en)}, ${q.correct_index}, ${b(q.active)});`,
  );
}
out.push('');
out.push('commit;');
out.push('');

writeFileSync(join(root, 'supabase', 'seed.sql'), out.join('\n'));
console.log(`seed.sql généré : ${SEED_QUESTIONS.length} questions, ${SEED_SERVICES.length} prestations, ${SEED_DRINKS.length} boissons, ${SEED_PRODUCTS.length} produits.`);
