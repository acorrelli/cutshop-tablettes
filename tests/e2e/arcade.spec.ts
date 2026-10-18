import { expect, test, type Page } from '@playwright/test';
import { openTablet, watchConsole } from './helpers';

/** Sert des bières jusqu'à la fin de la partie (maintien du bouton, relâche, attente de la note). */
async function pourUntilEnd(page: Page, hold = 2300) {
  const deadline = Date.now() + 75000;
  while (Date.now() < deadline) {
    if (await page.getByTestId('time-up').count()) return;
    if (!(await page.getByTestId('game-screen').count())) return;
    const b = await page.getByTestId('pour-hold').boundingBox();
    if (!b) return;
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(hold);
    await page.mouse.up();
    await page.waitForTimeout(1800);
  }
}

async function choosePseudo(page: Page, pseudo: string) {
  await expect(page.getByTestId('pseudo-dialog')).toBeVisible();
  await page.getByTestId('pseudo-input').fill(pseudo);
  await page.getByTestId('pseudo-ok').click();
}

test.describe('Cutshop Arcade', () => {
  test('Accueil Arcade : 4 jeux, pseudo filtré, Challenge et challenge de la semaine', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 1');
    await page.getByTestId('cat-games').click();
    await page.getByTestId('tile-arcade').click();
    for (const g of ['barber', 'pour', 'beat', 'findit']) await expect(page.getByTestId(`arcade-card-${g}`)).toBeVisible();
    await expect(page.getByTestId('arcade-weekly')).toBeVisible();

    await page.getByTestId('arcade-play-pour').click();
    await page.getByTestId('pseudo-input').fill('connard');
    await page.getByTestId('pseudo-ok').click();
    await expect(page.getByTestId('pseudo-dialog')).toContainText('pas accepté');
    await page.getByTestId('pseudo-input').fill('Barbe Noire');
    await page.getByTestId('pseudo-ok').click();
    await expect(page.getByTestId('solo-intro')).toBeVisible();
    await expect(page.getByTestId('pseudo-chip')).toContainText('Barbe Noire');

    await page.getByTestId('back-button').click();
    await page.getByTestId('arcade-challenge-link').click();
    await expect(page.getByTestId('leaderboard')).toBeVisible();
    await page.getByTestId('tab-week').click();
    await expect(page.getByTestId('week-panel')).toContainText('Une bière offerte au bar');
    expect(errors).toEqual([]);
  });

  test('Partie solo Perfect Pour : score enregistré et classé', async ({ page }) => {
    test.setTimeout(150000);
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 1', 'arcade/jouer/pour');
    await page.getByTestId('solo-start').click();
    await choosePseudo(page, 'Solo Pro');
    await expect(page.getByTestId('countdown')).toBeVisible();
    await expect(page.getByTestId('countdown')).toBeHidden({ timeout: 8000 });
    await pourUntilEnd(page);
    await expect(page.getByTestId('solo-result')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('result-status')).toContainText('du jour', { timeout: 10000 });
    const score = Number((await page.getByTestId('result-score').innerText()).replace(/\D/g, ''));
    expect(score).toBeGreaterThan(0);

    await page.getByTestId('result-challenge').click();
    await page.getByTestId('board-pour').click();
    await expect(page.getByTestId('board-list')).toContainText('Solo Pro');
    expect(errors).toEqual([]);
  });

  test('Duel Perfect Pour entre deux tablettes : invitation, partie synchronisée, podium et revanche', async ({ context }) => {
    test.setTimeout(200000);
    const [p1, p2] = await Promise.all([context.newPage(), context.newPage()]);
    const errors = [...watchConsole(p1), ...watchConsole(p2)];
    await openTablet(p1, 'Tablette 1', 'arcade/challenge');
    await openTablet(p2, 'Tablette 2', 'reseaux');

    await expect(p1.getByTestId('pick-table-2')).toHaveAttribute('data-status', 'available', { timeout: 8000 });
    await p1.getByTestId('pick-table-2').click();
    await p1.getByTestId('pick-game-pour').click();
    await p1.getByTestId('send-challenge').click();
    await choosePseudo(p1, 'Alex');
    await expect(p1.getByTestId('room-lobby')).toBeVisible();

    // L'invitation apparaît sur l'autre tablette, quelle que soit la page affichée.
    await expect(p2.getByTestId('arcade-invite')).toBeVisible({ timeout: 8000 });
    await expect(p2.getByTestId('arcade-invite')).toContainText('Alex');
    await p2.getByTestId('invite-accept').click();
    await choosePseudo(p2, 'Sam');
    await expect(p2.getByTestId('room-lobby')).toBeVisible();
    await expect(p1.getByTestId('room-start')).toBeDisabled();
    await p2.getByTestId('room-ready').click();
    await expect(p1.getByTestId('room-start')).toBeEnabled({ timeout: 8000 });
    await p1.getByTestId('room-start').click();

    await expect(p1.getByTestId('game-screen')).toBeVisible();
    await expect(p2.getByTestId('game-screen')).toBeVisible({ timeout: 8000 });
    await expect(p1.getByTestId('hud-opponents')).toContainText('Sam');
    await Promise.all([pourUntilEnd(p1, 2350), pourUntilEnd(p2, 1900)]);

    await expect(p1.getByTestId('room-finished')).toBeVisible({ timeout: 30000 });
    await expect(p2.getByTestId('room-finished')).toBeVisible({ timeout: 30000 });
    await expect(p1.getByTestId('room-ranking')).toContainText('Alex');
    await expect(p1.getByTestId('room-ranking')).toContainText('Sam');
    const w1 = await p1.getByTestId('room-winner').innerText();
    const w2 = await p2.getByTestId('room-winner').innerText();
    // Un seul vainqueur, le même sur les deux tablettes.
    expect([w1, w2].filter((w) => w.includes('VICTOIRE')).length).toBe(1);

    await p2.getByTestId('room-rematch').click();
    await expect(p1.getByTestId('arcade-invite')).toBeVisible({ timeout: 8000 });
    await expect(p1.getByTestId('arcade-invite')).toContainText('Sam');
    expect(errors).toEqual([]);
  });

  test('Battle : invitation refusée, table qui se déconnecte, une seule partie par tablette', async ({ context }) => {
    test.setTimeout(120000);
    const [p1, p2, p3] = await Promise.all([context.newPage(), context.newPage(), context.newPage()]);
    const errors = [...watchConsole(p1), ...watchConsole(p2)];
    await openTablet(p1, 'Tablette 1', 'arcade/challenge');
    await openTablet(p2, 'Tablette 2', 'arcade/challenge');
    await openTablet(p3, 'Tablette 3', 'arcade');

    await expect(p1.getByTestId('pick-table-3')).toHaveAttribute('data-status', 'available', { timeout: 8000 });
    await p1.getByTestId('pick-table-2').click();
    await p1.getByTestId('pick-table-3').click();
    await p1.getByTestId('pick-game-findit').click();
    await p1.getByTestId('pick-variant-hunt').click();
    await expect(p1.getByTestId('send-challenge')).toContainText('3');
    await p1.getByTestId('send-challenge').click();
    await choosePseudo(p1, 'Hote');

    // Table 2 refuse.
    await expect(p2.getByTestId('arcade-invite')).toBeVisible({ timeout: 8000 });
    await p2.getByTestId('invite-decline').click();
    await expect(p1.getByTestId('room-player-2')).toHaveAttribute('data-state', 'declined', { timeout: 8000 });

    // Table 3 accepte puis la tablette se coupe : elle quitte le lobby après 15 secondes sans signe de vie.
    await expect(p3.getByTestId('arcade-invite')).toBeVisible({ timeout: 8000 });
    await p3.getByTestId('invite-accept').click();
    await choosePseudo(p3, 'Lou');
    await expect(p1.getByTestId('room-player-3')).toHaveAttribute('data-state', 'joined', { timeout: 8000 });
    await p3.close();
    await expect(p1.getByTestId('room-player-3')).toHaveAttribute('data-state', 'left', { timeout: 30000 });
    await expect(p1.getByTestId('room-start')).toBeDisabled();

    // L'hôte est déjà dans une partie : il ne peut pas en ouvrir une autre.
    await p1.goto(p1.url().replace(/#.*$/, '#/arcade/challenge'));
    await expect(p1.getByTestId('back-to-room')).toBeVisible({ timeout: 8000 });
    await p1.getByTestId('back-to-room').click();
    await p1.getByTestId('room-leave').click();
    await expect(p1.getByTestId('defy-panel')).toBeVisible();
    expect(errors).toEqual([]);
  });
});
