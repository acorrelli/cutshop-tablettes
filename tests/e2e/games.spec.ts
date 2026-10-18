import { expect, test, type Page } from '@playwright/test';
import { adminLogin, enableModule, openTablet, watchConsole } from './helpers';

async function answerUntilPodium(pages: Page[], skip: Set<Page> = new Set()) {
  const done = new Set<Page>();
  const deadline = Date.now() + 240000;
  while (done.size < pages.length && Date.now() < deadline) {
    for (const p of pages) {
      if (done.has(p) || skip.has(p)) continue;
      if (await p.getByTestId('battle-podium').count()) {
        done.add(p);
        continue;
      }
      const btn = p.getByTestId('answer-0');
      if ((await btn.count()) && (await btn.isEnabled())) await btn.click().catch(() => undefined);
    }
    await pages[0].waitForTimeout(250);
    for (const p of skip) done.add(p);
  }
}

test.describe('Jeux', () => {
  test('Battle à 4 joueurs dans 4 onglets, avec un départ en cours de partie', async ({ context }) => {
    test.setTimeout(300000);
    const pages = await Promise.all([1, 2, 3, 4].map(() => context.newPage()));
    const errors = pages.flatMap((p) => watchConsole(p));
    for (const [i, p] of pages.entries()) await openTablet(p, `Tablette ${i + 1}`);

    const [host, ...others] = pages;
    await host.getByTestId('cat-games').click();
    await host.getByTestId('tile-battle').click();
    await host.getByTestId('battle-pseudo').fill('Alpha');
    await host.getByTestId('theme-kids').click();
    await host.getByTestId('battle-launch').click();
    await expect(host.getByTestId('battle-lobby')).toBeVisible();

    // Les autres tablettes reçoivent l'invitation instantanément, où qu'elles soient.
    const names = ['Bravo', 'Charlie', 'Delta'];
    for (const [i, p] of others.entries()) {
      await expect(p.getByTestId('battle-invite-banner')).toBeVisible({ timeout: 5000 });
      await expect(p.getByTestId('battle-invite-banner')).toContainText('Alpha lance un Cutshop Challenge depuis Tablette 1');
      await p.getByTestId('invite-join').click();
      await p.getByTestId('battle-pseudo').fill(names[i]);
      await p.getByTestId('battle-join').click();
      await expect(p.getByTestId('battle-lobby')).toBeVisible();
    }
    // Lobby complet : départ automatique sur les 4 tablettes.
    for (const p of pages) await expect(p.getByTestId('battle-countdown')).toBeVisible({ timeout: 8000 });
    for (const p of pages) await expect(p.getByTestId('battle-question')).toBeVisible({ timeout: 8000 });
    const q1 = await host.getByTestId('question-text').innerText();
    for (const p of others) await expect(p.getByTestId('question-text')).toHaveText(q1);

    // Delta quitte la partie (onglet fermé) après la première question : la partie continue.
    for (const p of pages) await p.getByTestId('answer-0').click();
    for (const p of pages) await expect(p.getByTestId('answer-feedback')).not.toBeEmpty({ timeout: 8000 });
    const delta = pages[3];
    await delta.close();
    await answerUntilPodium(pages.slice(0, 3));

    const titles = await Promise.all(pages.slice(0, 3).map((p) => p.getByTestId('podium-title').innerText()));
    const podiums = await Promise.all(pages.slice(0, 3).map((p) => p.getByTestId('battle-podium').innerText()));
    // Un seul gagnant, reconnu par toutes les tablettes : il voit « tu remportes », les autres voient son pseudo.
    const norm = titles.map((t) => t.toLowerCase().replace(/\u00a0/g, ' '));
    const winnerIdx = norm.findIndex((t) => t.includes('tu remportes le cutshop challenge'));
    if (winnerIdx < 0) {
      // Cas rare : personne n'a marqué (tout le monde a répondu A et A était toujours faux).
      for (const t of norm) expect(t).toContain('aucun point');
    } else {
      const winnerPseudo = ['alpha', 'bravo', 'charlie'][winnerIdx];
      norm.forEach((t, i) => {
        if (i !== winnerIdx) expect(t).toBe(`${winnerPseudo} remporte le cutshop challenge !`);
      });
    }
    // Le classement est identique sur les trois tablettes.
    const boards = podiums.map((p) => p.split('\n').slice(3).join('|'));
    expect(new Set(boards).size, JSON.stringify(boards)).toBe(1);
    for (const p of pages.slice(0, 3)) await expect(p.getByTestId('battle-podium')).toContainText('Delta');
    expect(errors).toEqual([]);
  });

  test('Battle : personne ne rejoint, partie solo proposée et jouée', async ({ page }) => {
    test.setTimeout(240000);
    const errors = watchConsole(page);
    await page.clock.install();
    await openTablet(page, 'Tablette 1', 'battle');
    await page.getByTestId('battle-pseudo').fill('Solo');
    await page.getByTestId('battle-launch').click();
    await expect(page.getByTestId('battle-lobby')).toBeVisible();
    await page.clock.fastForward(31000);
    await expect(page.getByTestId('battle-alone')).toBeVisible();
    await page.getByTestId('battle-solo-offer').click();
    await page.clock.runFor(3500);
    for (let i = 0; i < 10; i++) {
      await expect(page.getByTestId('answer-1')).toBeEnabled();
      await page.getByTestId('answer-1').click();
      await expect(page.getByTestId('answer-feedback')).not.toBeEmpty();
      await page.clock.runFor(5600);
    }
    await expect(page.getByTestId('battle-podium')).toBeVisible();
    await expect(page.getByTestId('podium-title')).toContainText('Ton score');
    expect(errors).toEqual([]);
  });

  test('Stop à 10 secondes : chrono caché, résultat, classement du jour', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 2', 'stop10');
    await page.getByTestId('stop10-start').click();
    await expect(page.getByTestId('stop10-timer')).toContainText(',');
    await page.waitForTimeout(3300);
    await expect(page.getByTestId('stop10-timer')).toContainText('Compte dans ta tête');
    await page.waitForTimeout(1500);
    await page.getByTestId('stop10-stop').dispatchEvent('pointerdown');
    const result = page.getByTestId('stop10-result');
    await expect(result).toContainText('Écart');
    await expect(result).toContainText(/\d,\d\d\s?s/);
    await page.locator('input[name="pseudo"]').fill('Flash');
    await page.getByTestId('stop10-save').click();
    await expect(page.getByTestId('stop10-board')).toContainText('Flash');
    expect(errors).toEqual([]);
  });

  test('Roue : activation par l’équipe, PIN, tirage et validation du code', async ({ page }) => {
    test.setTimeout(120000);
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 3');
    await adminLogin(page);
    await enableModule(page, 'wheel');
    await page.getByRole('button', { name: 'Retour tablette' }).click();
    await page.getByTestId('cat-games').click();
    await expect(page.getByTestId('tile-wheel')).toBeVisible();
    await expect(page.getByTestId('category-tiles').locator('a')).toHaveCount(4);

    // Plusieurs tours pour voir à la fois des gains et des pertes ; chaque tour demande le PIN.
    let codes: string[] = [];
    for (let round = 0; round < 6; round++) {
      await page.getByTestId('home-button').click();
      await page.getByTestId('cat-games').click();
      await page.getByTestId('tile-wheel').click();
      await expect(page.getByTestId('wheel-locked')).toBeVisible();
      if (round === 0) {
        for (const d of '1111') await page.getByTestId(`pin-${d}`).click();
        await page.getByTestId('pin-ok').click();
        await expect(page.getByTestId('pin-error')).toContainText('Code incorrect');
        for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Effacer' }).click();
      }
      for (const d of '2468') await page.getByTestId(`pin-${d}`).click();
      await page.getByTestId('pin-ok').click();
      await expect(page.getByTestId('wheel-reason')).toContainText('Tour activé par l’équipe');
      await page.getByTestId('wheel-spin').click();
      const outcome = page.getByTestId('wheel-outcome');
      await expect(outcome).toBeVisible({ timeout: 12000 });
      if (await page.getByTestId('wheel-code').count()) {
        const code = (await page.getByTestId('wheel-code').innerText()).trim();
        expect(code).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        codes.push(code);
      }
      await outcome.getByRole('button').click();
    }
    codes = Array.from(new Set(codes));
    if (codes.length) {
      await adminLogin(page);
      await page.getByTestId('nav-roue').click();
      await page.getByTestId('redeem-input').fill(codes[0]);
      await page.getByTestId('redeem-submit').click();
      await expect(page.getByTestId('redeem-result')).toContainText('Code valide');
      await page.getByTestId('redeem-input').fill(codes[0]);
      await page.getByTestId('redeem-submit').click();
      await expect(page.getByTestId('redeem-result')).toContainText('Déjà utilisé');
    }
    expect(errors).toEqual([]);
  });

  test('Coin des kids : Petit Barbier et Memory', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 4', 'kids');
    await page.getByTestId('kids-barber').click();
    const canvas = page.getByTestId('barber-canvas');
    const box = (await canvas.boundingBox())!;
    const before = await canvas.locator('path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d')).join());
    await page.getByTestId('tool-clipper').click();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.18);
    await page.mouse.down();
    for (let i = 0; i < 12; i++) await page.mouse.move(box.x + box.width * (0.35 + i * 0.025), box.y + box.height * 0.2);
    await page.mouse.up();
    await page.waitForTimeout(100);
    const after = await canvas.locator('path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d')).join());
    expect(after).not.toEqual(before);
    await page.getByTestId('barber-reset').click();
    await page.waitForTimeout(100);
    const reset = await canvas.locator('path').evaluateAll((ps) => ps.map((p) => p.getAttribute('d')).join());
    expect(reset).toEqual(before);

    await page.goto('/#/kids/memory');
    const cards = page.getByTestId('memory-card');
    await expect(cards).toHaveCount(12);
    // Résout la partie en retrouvant les paires grâce à l'attribut data-face.
    const faces = await cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-face')));
    const done = new Set<number>();
    for (let i = 0; i < faces.length; i++) {
      if (done.has(i)) continue;
      const j = faces.findIndex((f, k) => k !== i && f === faces[i]);
      await cards.nth(i).click();
      await cards.nth(j).click();
      done.add(i).add(j);
      await page.waitForTimeout(450);
    }
    await expect(page.getByTestId('memory-win')).toContainText('Bravo');
    await page.getByTestId('memory-win').getByRole('button').click();
    await page.getByTestId('memory-hard').click();
    await expect(cards).toHaveCount(24);
    expect(errors).toEqual([]);
  });
});
