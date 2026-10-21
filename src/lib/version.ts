// Version de l'application en cours (injectée à la construction : « 2026-10-21T15:02Z abc1234 »).
export const APP_VERSION: string = import.meta.env.VITE_APP_VERSION || 'dev';

/** Date de publication lisible : « 21/10 à 17:02 » (heure de Bruxelles). */
export function versionLabel(version: string | null | undefined): string | null {
  const iso = version?.split(' ')[0];
  const d = iso ? new Date(iso.replace('Z', ':00Z')) : null;
  if (!d || Number.isNaN(d.getTime())) return null;
  const day = d.toLocaleDateString('fr-BE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Brussels' });
  const time = d.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Brussels' });
  return `${day} à ${time}`;
}
