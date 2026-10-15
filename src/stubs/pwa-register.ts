// Remplace le service worker dans la version HTML autonome (aperçu sans installation).
export function registerSW(): () => Promise<void> {
  return async () => undefined;
}
