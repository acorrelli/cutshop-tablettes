import { expect, type Page } from '@playwright/test';

/** Échoue le test si la moindre erreur console apparaît. */
export function watchConsole(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    // Avertissement émis par Playwright lui même (service worker bloqué pendant les tests), pas par l'application.
    if (m.text().includes('Service Worker registration blocked by Playwright')) return;
    if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`);
  });
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Ouvre l'application comme une tablette déjà configurée. */
export async function openTablet(page: Page, tablet = 'Tablette 1', hash = '') {
  await page.goto(`/?tablet=${encodeURIComponent(tablet)}#/${hash}`);
  await expect(page.getByTestId('home-button')).toBeVisible();
}

/** Connexion admin en mode démo puis activation éventuelle de modules. */
export async function adminLogin(page: Page) {
  // Navigation par le hash uniquement : on reste dans le même document (données de démo en mémoire).
  await page.evaluate(() => {
    window.location.hash = '#/admin';
  });
  // Déjà connecté dans cette session : rien à faire.
  const logged = page.getByTestId('admin-logout');
  const form = page.getByTestId('admin-login');
  await expect(logged.or(form)).toBeVisible();
  if (await logged.isVisible()) return;
  await page.locator('input[name="email"]').fill('staff@cutshop.test');
  await page.locator('input[name="password"]').fill('demo');
  await page.getByTestId('admin-login-submit').click();
  await expect(page.getByTestId('admin-logout')).toBeVisible();
}

export async function enableModule(page: Page, key: string) {
  await page.getByTestId('nav-modules').click();
  const btn = page.getByTestId(`module-${key}`);
  await expect(btn).toBeVisible();
  const on = await btn.locator('span.bg-gold').count();
  if (!on) await btn.click();
  await expect(btn.locator('span.bg-gold')).toHaveCount(1);
}

/** Vérifie qu'aucun tiret isolé n'est affiché dans la page (le trait d'union dans un mot est permis). */
export async function expectNoDashes(page: Page) {
  const text = await page.locator('body').innerText();
  const found = text.split('\n').filter((l) => /[‐‒–—―−]|(^|[^\p{L}\p{N}}])-|-([^\p{L}\p{N}]|$)/u.test(l));
  expect(found, `Tirets visibles : ${found.join(' | ')}`).toEqual([]);
}
