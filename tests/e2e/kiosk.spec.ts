import { expect, test } from '@playwright/test';
import { adminLogin, expectNoDashes, openTablet, watchConsole } from './helpers';

test.describe('Fonctionnement des tablettes', () => {
  test('premier lancement : attribution du nom de la tablette', async ({ page }) => {
    const errors = watchConsole(page);
    await page.goto('/');
    await expect(page.getByText('Configuration de la tablette')).toBeVisible();
    await page.getByTestId('setup-3').click();
    await expect(page.getByTestId('tiles')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('tiles')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('nos services : catégories, tarifs étudiants et réservation', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page);
    await page.getByTestId('cat-services').click();
    await page.getByTestId('tile-services').click();
    await expect(page.getByTestId('service-card')).toHaveCount(7);
    const taper = page.getByTestId('service-card').filter({ hasText: 'Coupe taper' });
    await expect(taper).toContainText(/25,00\s?€/);
    await expect(taper.getByTestId('student-price')).toContainText(/22,00\s?€/);
    await expect(taper).toContainText('Shampoing non inclus');
    await page.getByTestId('services-cut_beard').click();
    await expect(page.getByTestId('service-card')).toHaveCount(7);
    await expect(page.getByTestId('service-card').filter({ hasText: 'Coupe mulet + barbe' })).toContainText(/42,50\s?€/);
    await page.getByTestId('services-care').click();
    await expect(page.getByTestId('service-card').filter({ has: page.getByRole('heading', { name: 'Épilation', exact: true }) })).toContainText(/15,00\s?€/);
    await page.getByTestId('services-kids').click();
    await expect(page.getByTestId('service-card')).toHaveCount(2);
    await page.getByTestId('service-book').first().click();
    await expect(page.getByTestId('service-book-sheet')).toContainText('Coupe enfant');
    await expectNoDashes(page);
    await page.keyboard.press('Escape');
    await expect(page.getByTestId('service-book-sheet')).toHaveCount(0);
    await page.getByTestId('lang-en').click();
    await expect(page.getByTestId('service-card').first()).toContainText('Kids cut');
    await expectNoDashes(page);
    expect(errors).toEqual([]);
  });

  test('accueil : tuiles, langue, grand texte et retour accueil', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page);
    // Accueil : 4 grands menus, puis les réseaux sociaux à part.
    await expect(page.getByTestId('tiles').locator('a')).toHaveCount(4);
    for (const c of ['cutshop', 'shop', 'services', 'games']) await expect(page.getByTestId(`cat-${c}`)).toBeVisible();
    for (const n of ['instagram', 'facebook', 'tiktok']) await expect(page.getByTestId(`home-social-${n}`)).toBeVisible();
    await expect(page.getByTestId('cat-games')).toContainText('remporter un cadeau');
    await page.getByTestId('cat-games').click();
    await expect(page.getByTestId('tile-battle')).toBeVisible();
    // La roue est masquée tant que l'équipe ne l'a pas activée.
    await expect(page.getByTestId('tile-wheel')).toHaveCount(0);
    await expect(page.getByTestId('category-tiles').locator('a')).toHaveCount(3);
    await page.getByTestId('back-button').click();
    await expect(page.getByTestId('next-event-banner')).toBeVisible();
    await expectNoDashes(page);

    await page.getByTestId('cat-services').click();
    await expect(page.getByTestId('category-tiles').locator('a')).toHaveCount(3);
    await page.getByTestId('lang-en').click();
    await expect(page.getByTestId('tile-booking')).toContainText('Book an appointment');
    await expectNoDashes(page);
    await page.getByTestId('lang-fr').click();
    await expect(page.getByTestId('tile-booking')).toContainText(/Prendre rendez.vous/);
    await page.getByTestId('back-button').click();

    const before = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    await page.getByTestId('large-text').click();
    const after = await page.evaluate(() => getComputedStyle(document.documentElement).fontSize);
    expect(parseFloat(after)).toBeGreaterThan(parseFloat(before));

    await page.getByTestId('cat-cutshop').click();
    await page.getByTestId('tile-concept').click();
    await expect(page.getByText('Cutshop, bien plus qu’une coupe', { exact: false })).toBeVisible();
    await expect(page.getByTestId('practical')).toContainText('Rue de la Chaussée 40');
    await expect(page.getByTestId('practical')).toContainText('Adresse');
    await page.getByTestId('home-button').click();
    await expect(page.getByTestId('tiles')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('chaque module s’affiche sans erreur ni tiret, en FR et en EN', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page);
    const routes = ['concept', 'rdv', 'evenements', 'battle', 'stop10', 'kids', 'kids/barbier', 'kids/memory', 'boissons', 'produits', 'cheques', 'factures', 'reseaux', 'jeux', 'boissons-produits', 'cutshop', 'confidentialite'];
    for (const lang of ['fr', 'en']) {
      await page.getByTestId(`lang-${lang}`).click();
      for (const r of routes) {
        await page.goto(`/#/${r}`);
        await expect(page.getByTestId('back-button')).toBeVisible();
        await page.waitForTimeout(150);
        await expectNoDashes(page);
        // Aucun texte coupé par des points de suspension CSS.
        const clamped = await page.locator('.truncate, .line-clamp-1, .line-clamp-2, .line-clamp-3').evaluateAll((els) =>
          els.filter((e) => e.scrollWidth > e.clientWidth + 1 || e.scrollHeight > e.clientHeight + 1).map((e) => e.textContent),
        );
        expect(clamped, `Texte tronqué sur ${r}`).toEqual([]);
      }
    }
    expect(errors).toEqual([]);
  });

  test('QR codes : rendez-vous Salonkee et Instagram', async ({ page }) => {
    await openTablet(page, 'Tablette 1', 'rdv');
    await expect(page.getByTestId('qrcode')).toHaveAttribute('data-value', 'https://salonkee.be/salon/cutshop-mons');
    await expect(page.getByTestId('qrcode').locator('svg')).toBeVisible();
    await page.goto('/#/reseaux');
    await expect(page.getByTestId('social-instagram').getByTestId('qrcode')).toHaveAttribute('data-value', 'https://www.instagram.com/cutshop_mons/');
    await expect(page.getByTestId('social-facebook').getByTestId('qrcode')).toHaveAttribute('data-value', 'https://www.facebook.com/cutshopmons/');
    await expect(page.getByTestId('social-tiktok').getByTestId('qrcode')).toHaveAttribute('data-value', 'https://www.tiktok.com/@cutshop_belgium');
  });

  test('veille après 60 secondes : formulaire effacé, langue et taille remises à zéro', async ({ page }) => {
    await page.clock.install();
    await openTablet(page, 'Tablette 2', 'factures');
    await page.getByTestId('lang-en').click();
    await page.getByTestId('large-text').click();
    await page.locator('input[name="company"]').fill('Studio Secret SRL');
    await page.locator('input[name="email"]').fill('secret@studio.be');
    await page.clock.fastForward(59000);
    await expect(page.getByTestId('screensaver')).toHaveCount(0);
    await page.clock.fastForward(2000);
    await expect(page.getByTestId('screensaver')).toBeVisible();
    await expect(page.getByTestId('screensaver')).toContainText('Touche l’écran');
    await page.getByTestId('screensaver').click({ position: { x: 20, y: 20 } });
    await expect(page.getByTestId('tiles')).toBeVisible();
    await expect(page.getByTestId('lang-fr')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.classList.contains('large-text'))).toBe(false);
    await page.goto('/#/factures');
    await expect(page.locator('input[name="company"]')).toHaveValue('');
    await expect(page.locator('input[name="email"]')).toHaveValue('');
  });

  test('l’appui long de 5 secondes sur le logo ouvre l’admin', async ({ page }) => {
    await openTablet(page);
    const logo = page.getByTestId('logo-secret');
    const box = (await logo.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(2000);
    await page.mouse.up();
    await expect(page.getByTestId('admin-login')).toHaveCount(0);
    await page.mouse.down();
    await page.waitForTimeout(5300);
    await page.mouse.up();
    await expect(page.getByTestId('admin-login')).toBeVisible();
  });

  test('aucune donnée personnelle dans le stockage local', async ({ page }) => {
    await openTablet(page, 'Tablette 1', 'evenements');
    await page.getByTestId('event-card').first().click();
    await page.locator('input[name="first"]').fill('Camille');
    await page.locator('input[name="last"]').fill('Privee');
    await page.locator('input[name="email"]').fill('camille.privee@example.com');
    await page.getByTestId('consent').click();
    await page.getByTestId('register-submit').click();
    await expect(page.getByTestId('success-overlay')).toBeVisible();
    const storage = await page.evaluate(() => JSON.stringify({ ...localStorage }) + JSON.stringify({ ...sessionStorage }));
    expect(storage).not.toContain('camille.privee');
    expect(storage).not.toContain('Privee');
  });
});

test('admin : chaque rubrique s’ouvre sans erreur ni tiret', async ({ page }) => {
  const errors = watchConsole(page);
  await openTablet(page);
  await adminLogin(page);
  for (const nav of ['demandes-produits', 'demandes-factures', 'evenements', 'roue', 'newsletter', 'quiz', 'boissons', 'produits', 'modules', 'reglages', 'statistiques']) {
    await page.getByTestId(`nav-${nav}`).click();
    await expect(page).toHaveURL(new RegExp(`#/admin/${nav}$`));
    await page.waitForTimeout(250);
    await expectNoDashes(page);
  }
  // Modification d'un contenu : le titre du concept change sur la tablette.
  await page.getByTestId('nav-reglages').click();
  await page.getByTestId('settings-group-1').click();
  const title = page.getByRole('dialog').locator('input').first();
  await title.fill('Cutshop, ton moment à Mons');
  await page.getByTestId('crud-save').click();
  await page.getByRole('button', { name: 'Retour tablette' }).click();
  await page.getByTestId('cat-cutshop').click();
  await page.getByTestId('tile-concept').click();
  await expect(page.getByText('Cutshop, ton moment à Mons')).toBeVisible();
  expect(errors).toEqual([]);
});

test('admin sur le Chromebook : ni veille ni déconnexion, même après 30 minutes', async ({ page }) => {
  await page.clock.install();
  await page.goto('/#/admin');
  await adminLogin(page);
  await page.getByTestId('nav-quiz').click();
  await expect(page.getByRole('button', { name: 'Retour tablette' })).toHaveCount(0);
  await page.clock.runFor(30 * 60000);
  await expect(page.getByTestId('admin-logout')).toBeVisible();
  await expect(page).toHaveURL(/#\/admin\/quiz$/);
  // Déconnexion volontaire : on reste sur l'écran de connexion admin, jamais sur la configuration d'une tablette.
  await page.getByTestId('admin-logout').click();
  await expect(page.getByTestId('admin-login')).toBeVisible();
  await page.clock.runFor(30 * 60000);
  await expect(page.getByTestId('admin-login')).toBeVisible();
});

test('admin sur une tablette cliente : retour à l’écran client après 3 minutes', async ({ page }) => {
  await page.clock.install();
  await openTablet(page);
  await adminLogin(page);
  await page.clock.runFor(3 * 60000 + 1000);
  await expect(page.getByTestId('admin-logout')).toHaveCount(0);
  await expect(page.getByTestId('home-button')).toBeVisible();
});
