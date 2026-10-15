// Génère le logo provisoire (public/logo_cutshop.png) et les icônes PWA.
// Le vrai logo remplacera simplement public/logo_cutshop.png (même nom de fichier).
// Usage : node scripts/make-assets.mjs [--icons-only]
import { chromium } from '@playwright/test';
import { existsSync } from 'node:fs';

const iconsOnly = process.argv.includes('--icons-only');
const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });

const logoHtml = `
<html><body style="margin:0;background:transparent">
<div id="c" style="width:512px;height:512px;display:flex;flex-direction:column;align-items:center;justify-content:center;font-family:Arial Black,Arial,Helvetica,sans-serif;color:#0B0B0B">
  <svg width="120" height="64" viewBox="0 0 120 64" fill="none" stroke="#0B0B0B" stroke-width="7" stroke-linecap="round">
    <circle cx="22" cy="44" r="13"/><circle cx="98" cy="44" r="13"/>
    <path d="M33 37 L86 8 M87 37 L34 8"/>
  </svg>
  <div style="font-size:150px;font-weight:900;line-height:0.9;letter-spacing:-4px;margin-top:10px">CUT</div>
  <div style="font-size:110px;font-weight:900;line-height:0.95;letter-spacing:2px">SHOP</div>
  <div style="margin-top:14px;font-family:Arial,Helvetica,sans-serif;font-weight:700;font-size:30px;letter-spacing:14px">MONS</div>
</div></body></html>`;

if (!iconsOnly || !existsSync('public/logo_cutshop.png')) {
  await page.setContent(logoHtml);
  await page.locator('#c').screenshot({ path: 'public/logo_cutshop.png', omitBackground: true });
}

const logoData = (await import('node:fs')).readFileSync('public/logo_cutshop.png').toString('base64');
const icon = (size, pad) => `
<html><body style="margin:0;background:transparent">
<div id="c" style="width:${size}px;height:${size}px;background:#164734;display:grid;place-items:center">
  <div style="width:${size * (1 - pad)}px;height:${size * (1 - pad)}px;border-radius:50%;background:#F4EBD9;display:grid;place-items:center">
    <img src="data:image/png;base64,${logoData}" style="width:78%;height:78%;object-fit:contain"/>
  </div>
</div></body></html>`;

for (const [file, size, pad] of [
  ['public/icons/icon-192.png', 192, 0.08],
  ['public/icons/icon-512.png', 512, 0.08],
  ['public/icons/icon-512-maskable.png', 512, 0.3],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(icon(size, pad));
  await page.locator('#c').screenshot({ path: file });
}
await browser.close();
console.log('Logo et icônes générés.');
