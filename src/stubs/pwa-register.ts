// Remplace le service worker dans la version HTML autonome (aperçu sans installation).
export function registerSW(_options?: unknown): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
