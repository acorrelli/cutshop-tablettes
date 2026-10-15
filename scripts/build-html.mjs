// Construit la version HTML autonome (un seul fichier, mode démonstration).
// Usage : node scripts/build-html.mjs  →  dist-html/cutshop-tablettes.html
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

execSync('npx vite build --config vite.artifact.config.ts', { stdio: 'inherit' });
let html = readFileSync('dist-html/index.html', 'utf8');
const logo = `data:image/png;base64,${readFileSync('public/logo_cutshop.png').toString('base64')}`;
const favicon = `data:image/svg+xml;base64,${readFileSync('public/favicon.svg').toString('base64')}`;
html = html.replaceAll('"./logo_cutshop.png"', JSON.stringify(logo));
if (html.includes('logo_cutshop.png')) throw new Error('Logo non intégré');

const head = html.match(/<head>([\s\S]*?)<\/head>/)[1];
const body = html.match(/<body>([\s\S]*?)<\/body>/)[1];
const styles = [...head.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0]).join('\n');
const scripts = [...head.matchAll(/<script[^>]*>[\s\S]*?<\/script>/g)].map((m) => m[0]).join('\n');

const page = `<title>Cutshop Mons</title>
<meta name="theme-color" content="#164734">
<link rel="icon" type="image/svg+xml" href="${favicon}">
<style>:root{color-scheme:dark;background:#0a2219}body{background:#0a2219;color:#f4ebd9}</style>
${styles}
${body.trim()}
${scripts}
`;
writeFileSync('dist-html/cutshop-tablettes.html', page);
console.log(`dist-html/cutshop-tablettes.html : ${(page.length / 1024).toFixed(0)} Ko`);
