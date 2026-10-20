import { expect, test } from '@playwright/test';
import { adminLogin, expectNoDashes, openTablet, watchConsole } from './helpers';

/** Morceau de test en WAV (grosse caisse à 124 BPM, caisse claire sur 2 et 4, charleston), 80 secondes. */
function testSong(): Buffer {
  const sr = 22050;
  const n = sr * 80;
  const pcm = new Float32Array(n);
  let rnd = 7;
  const noise = () => {
    rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
    return rnd / 2147483648 - 1;
  };
  const beat = 60 / 124;
  for (let k = 0; 0.3 + k * beat < 79.5; k++) {
    const t0 = 0.3 + k * beat;
    const add = (at: number, len: number, f: (t: number) => number) => {
      const i0 = Math.round(at * sr);
      for (let i = 0; i < len * sr && i0 + i < n; i++) pcm[i0 + i] += f(i / sr);
    };
    add(t0, 0.25, (t) => Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14) * 0.8);
    if (k % 2 === 1) add(t0, 0.18, (t) => noise() * 0.5 * Math.exp(-t * 22));
    add(t0 + beat / 2, 0.05, (t) => noise() * 0.2 * Math.exp(-t * 80));
  }
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + n * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, pcm[i])) * 32000), 44 + i * 2);
  return buf;
}

test('Beat Drop : une musique importée dans l’admin se choisit et se joue sur la tablette', async ({ page }) => {
  test.setTimeout(180000);
  const errors = watchConsole(page);
  await openTablet(page, 'Tablette 1');
  await adminLogin(page);
  await page.getByTestId('nav-musiques').click();
  await expect(page.getByTestId('admin-beat-tracks')).toBeVisible();
  await expectNoDashes(page);
  await page.getByTestId('beat-add').click();
  await page.getByTestId('beat-file').setInputFiles({ name: 'DJ Test - Mons Anthem.wav', mimeType: 'audio/wav', buffer: testSong() });
  await expect(page.getByTestId('beat-start')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('beat-title')).toHaveValue('Mons Anthem');
  await expect(page.getByTestId('beat-artist')).toHaveValue('DJ Test');
  await page.getByTestId('beat-level-easy').click();
  await page.getByTestId('beat-save').click();
  const row = page.locator('[data-testid^="beat-row-"]');
  await expect(row).toHaveCount(1, { timeout: 90000 });
  await expect(row).toContainText(/12[34] BPM/);
  await expectNoDashes(page);
  // Écoute de contrôle avec repères, puis arrêt.
  const preview = page.locator('[data-testid^="beat-preview-"]');
  await preview.click();
  await expect(preview).toContainText('Arrêter', { timeout: 15000 });
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/admin-beat.png`, fullPage: true });
  await preview.click();
  await expect(preview).toContainText('Écouter');

  // Réglage fin des notes : enregistré sans erreur.
  await page.getByRole('button', { name: 'Avancer de 20 ms' }).click();
  await expect(row).toContainText('Notes avancées de 20 ms.');
  // Pochette ajoutée après l'enregistrement.
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
  await row.locator('[data-testid^="beat-cover-"]').setInputFiles({ name: 'pochette.png', mimeType: 'image/png', buffer: png });
  await expect(row).toContainText('Pochette enregistrée.');
  await expect(row.getByRole('button', { name: 'Retirer la pochette' })).toBeVisible();
  await expect(row.locator('img')).toHaveCount(1);
  await expectNoDashes(page);

  await page.getByRole('button', { name: 'Retour tablette' }).click();
  await page.evaluate(() => {
    window.location.hash = '#/arcade/jouer/beat';
  });
  // La musique est classée en FACILE : elle n'apparaît que dans ce niveau.
  await page.getByTestId('variant-medium').click();
  await expect(page.getByTestId('beat-tracks')).toHaveCount(0);
  await page.getByTestId('variant-hard').click();
  await expect(page.getByTestId('beat-tracks')).toHaveCount(0);
  await page.getByTestId('variant-easy').click();
  await expect(page.getByTestId('beat-tracks')).toBeVisible();
  const card = page.locator('[data-testid^="beat-track-"]:not([data-testid="beat-track-random"])');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('Mons Anthem');
  await card.click();
  await expect(card).toHaveAttribute('aria-pressed', 'true');
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/solo-beat.png` });
  const audio = page.getByTestId('audio-enable');
  if (await audio.isVisible()) await audio.click();
  await page.getByTestId('solo-start').click();
  const dlg = page.getByTestId('pseudo-dialog');
  if (await dlg.isVisible().catch(() => false)) {
    await page.getByTestId('pseudo-input').fill('Beat Tester');
    await page.getByTestId('pseudo-ok').click();
  }
  await expect(page.getByTestId('beat-root')).toHaveAttribute('data-song', 'Mons Anthem', { timeout: 10000 });
  await expect(page.getByTestId('countdown')).toBeHidden({ timeout: 10000 });
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(['KeyD', 'KeyF', 'KeyJ', 'KeyK'][i % 4]);
    await page.waitForTimeout(250);
  }
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/game-beat.png` });

  // Changement de niveau dans l'admin : la musique passe en DIFFICILE.
  await adminLogin(page);
  await page.getByTestId('nav-musiques').click();
  const saved = page.locator('[data-testid^="beat-row-"]');
  await saved.locator('[data-testid$="-hard"]').click();
  await saved.getByRole('button', { name: 'Enregistrer les modifications' }).click();
  await expect(saved).toContainText('Enregistré.');
  await page.getByRole('button', { name: 'Retour tablette' }).click();
  await page.evaluate(() => {
    window.location.hash = '#/arcade/jouer/beat';
  });
  await expect(page.getByTestId('solo-intro')).toBeVisible();
  await page.getByTestId('variant-easy').click();
  await expect(page.getByTestId('beat-tracks')).toHaveCount(0);
  await page.getByTestId('variant-hard').click();
  await expect(page.getByTestId('beat-tracks')).toContainText('Mons Anthem');
  expect(errors).toEqual([]);
});
