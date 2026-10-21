// Mises à jour de l'application sur les tablettes qui restent ouvertes toute la journée :
// le service worker cherche une nouvelle version toutes les 10 minutes, la télécharge en arrière plan,
// puis la tablette l'installe (rechargement) à sa prochaine mise en veille, jamais pendant une partie.
// Sur le Chromebook de l'équipe, l'admin affiche un bouton « Mettre à jour ».
import { registerSW } from 'virtual:pwa-register';

const CHECK_MS = 10 * 60000;
let ready = false;
let update: ((reload?: boolean) => Promise<void>) | null = null;
const listeners = new Set<(ready: boolean) => void>();

export function initAppUpdate(): void {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return;
  update = registerSW({
    immediate: true,
    onNeedRefresh() {
      ready = true;
      listeners.forEach((cb) => cb(true));
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => {
        if (navigator.onLine) void registration.update().catch(() => undefined);
      }, CHECK_MS);
    },
  });
}

export function isUpdateReady(): boolean {
  return ready;
}

export function onUpdateReady(cb: (ready: boolean) => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Installe la nouvelle version et recharge la page. */
export function applyUpdate(): void {
  if (ready && update) void update(true);
}
