// Assemble en un seul fichier tout ce qu'il faut exécuter sur un projet Supabase neuf :
// les migrations dans l'ordre, puis les données d'exemple. Usage : npm run sql:setup
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const parts = readdirSync('supabase/migrations')
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => `supabase/migrations/${f}`);
parts.push('supabase/seed.sql');

const header = `-- Cutshop Mons : installation complète de la base (fichier généré par scripts/build-setup-sql.mjs).
-- À coller en une fois dans SQL Editor d'un projet Supabase neuf, puis Run. Ne pas exécuter deux fois.
-- Contenu : ${parts.join(', ')}
`;
const body = parts.map((p) => `\n-- ===== ${p} =====\n${readFileSync(p, 'utf8')}`).join('\n');
writeFileSync('supabase/installation_complete.sql', header + body);
console.log(`supabase/installation_complete.sql : ${parts.length} fichiers, ${Math.round((header + body).length / 1024)} Ko`);
