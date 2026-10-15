import { expect, test } from '@playwright/test';
import { adminLogin, openTablet, watchConsole } from './helpers';

test.describe('Formulaires et demandes', () => {
  test('inscription à un événement, capacité et écran complet', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 1', 'evenements');
    const chut = page.getByTestId('event-card').filter({ hasText: 'Chut' }).first();
    await expect(chut).toContainText('20 places restantes');
    await chut.click();

    // Consentement obligatoire et mail valide.
    await page.locator('input[name="first"]').fill('Lina');
    await page.locator('input[name="last"]').fill('Dupont');
    await page.locator('input[name="email"]').fill('pas-un-mail');
    await page.getByTestId('register-submit').click();
    await expect(page.getByText('Cette adresse mail ne semble pas valide')).toBeVisible();
    await expect(page.getByText('Coche la case de consentement pour continuer')).toBeVisible();

    const register = async (seats: number, email: string, newsletter = false) => {
      await page.locator('input[name="first"]').fill('Lina');
      await page.locator('input[name="last"]').fill('Dupont');
      await page.locator('input[name="email"]').fill(email);
      for (let i = 1; i < seats; i++) await page.getByRole('button', { name: 'plus' }).click();
      await page.getByTestId('consent').click();
      if (newsletter) await page.getByTestId('newsletter').click();
      await page.getByTestId('register-submit').click();
      await expect(page.getByTestId('success-overlay')).toBeVisible();
      await page.getByTestId('success-overlay').getByRole('button').click();
    };

    await register(6, 'lina@example.com', true);
    await expect(page.getByTestId('event-list')).toBeVisible();
    const card = page.getByTestId('event-card').filter({ hasText: 'Chut' }).first();
    await expect(card).toContainText('14 places restantes');
    await card.click();
    // Le formulaire a bien été vidé.
    await expect(page.locator('input[name="first"]')).toHaveValue('');
    await register(6, 'tom@example.com');
    await page.getByTestId('event-card').filter({ hasText: 'Chut' }).first().click();
    await register(6, 'max@example.com');
    await page.getByTestId('event-card').filter({ hasText: 'Chut' }).first().click();
    await expect(page.getByTestId('seats-left')).toContainText('2 places restantes');
    await register(2, 'zoe@example.com');
    const full = page.getByTestId('event-card').filter({ hasText: 'Chut' }).first();
    await expect(full).toContainText('Complet');
    await full.click();
    await expect(page.getByTestId('event-full')).toContainText('Victime de son succès');

    // L'admin voit les inscrits et la newsletter.
    await adminLogin(page);
    await page.getByTestId('nav-newsletter').click();
    await expect(page.getByText('lina@example.com')).toBeVisible();
    await expect(page.getByText('tom@example.com')).toHaveCount(0);
    await page.getByTestId('nav-evenements').click();
    await page.getByRole('row').filter({ hasText: 'Chut' }).first().getByTestId('show-registrations').click();
    await expect(page.getByText('20 / 20 places réservées')).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export CSV' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^inscrits_Chut_.*\.csv$/);
    expect(errors).toEqual([]);
  });

  test('factures pros : validation TVA, envoi et effacement', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 2', 'factures');
    await page.locator('input[name="company"]').fill('Studio Lumière SRL');
    await page.locator('input[name="vat"]').fill('BE0123456789');
    await page.locator('input[name="address"]').fill('Grand Place 1, 7000 Mons');
    await page.locator('input[name="email"]').fill('compta@studio.be');
    await page.locator('input[name="first"]').fill('Alex');
    await page.locator('input[name="last"]').fill('Martin');
    await page.getByTestId('invoice-consent').click();
    await page.getByTestId('invoice-submit').click();
    await expect(page.getByText('Ce numéro de TVA belge n’est pas valide', { exact: false })).toBeVisible();
    await page.locator('input[name="vat"]').fill('XX123');
    await page.getByTestId('invoice-submit').click();
    await expect(page.getByText('Format de TVA non reconnu', { exact: false })).toBeVisible();
    await page.locator('input[name="vat"]').fill('BE 0123.456.749');
    await page.getByTestId('invoice-submit').click();
    await expect(page.getByTestId('success-overlay')).toContainText('Demande envoyée');
    await page.getByTestId('success-overlay').getByRole('button').click();
    for (const n of ['company', 'vat', 'address', 'email', 'first', 'last']) await expect(page.locator(`input[name="${n}"]`)).toHaveValue('');

    await adminLogin(page);
    await page.getByTestId('nav-demandes-factures').click();
    await expect(page.getByTestId('invoice-requests')).toContainText('Studio Lumière SRL');
    await expect(page.getByTestId('invoice-requests')).toContainText('BE 0123.456.749');
    await page.getByTestId('request-status').first().click();
    await expect(page.getByText('Rien à afficher.')).toBeVisible();
    expect(errors).toEqual([]);
  });

  test('produits faits pour toi : questionnaire, sélection et envoi au coiffeur', async ({ page }) => {
    const errors = watchConsole(page);
    await openTablet(page, 'Tablette 3', 'produits');
    await page.getByTestId('products-start').click();
    await page.getByRole('button', { name: 'Bouclés' }).click();
    await page.getByRole('button', { name: 'Sec' }).click();
    await page.getByRole('button', { name: 'Oui' }).click();
    await page.getByRole('button', { name: 'Soin' }).click();
    const cards = page.getByTestId('product-card');
    const n = await cards.count();
    expect(n).toBeGreaterThanOrEqual(2);
    expect(n).toBeLessThanOrEqual(4);
    await expect(page.getByTestId('products-result')).toContainText('barbe', { ignoreCase: true });
    await page.getByTestId('products-talk').click();
    await page.locator('input[name="firstName"]').fill('Sam');
    await page.getByTestId('products-send').click();
    await expect(page.getByTestId('success-overlay')).toContainText('Parles en avec ton coiffeur pendant ta coupe');

    await adminLogin(page);
    await page.getByTestId('nav-demandes-produits').click();
    await expect(page.getByTestId('product-requests')).toContainText('Sam');
    await expect(page.getByTestId('product-requests')).toContainText('cheveux bouclés', { ignoreCase: true });
    expect(errors).toEqual([]);
  });

  test('chèques cadeaux : appel à l’accueil visible dans l’admin', async ({ page }) => {
    await openTablet(page, 'Tablette 4', 'cheques');
    await page.getByTestId('gift-ask').click();
    await expect(page.getByTestId('success-overlay')).toContainText('Un membre de l’équipe vient vers toi');
    await adminLogin(page);
    await expect(page.getByText('Tablette 4 demande des infos sur les chèques cadeaux', { exact: false })).toBeVisible();
  });
});
