// Photos livrées avec l'application (src/assets/photos). Un contenu y fait référence par « photo:nom ».
// Si le fichier n'existe pas encore, l'emplacement affiche le visuel de remplacement.

const files = import.meta.glob('../assets/photos/*.{jpg,jpeg,png,webp,JPG,JPEG,PNG,WEBP}', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const byName: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const name = path.split('/').pop()!.replace(/\.[^.]+$/, '').toLowerCase();
  byName[name] = url;
}

/** Résout une source d'image : URL classique, ou « photo:nom » vers une photo du dossier. */
export function resolvePhoto(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith('photo:')) return byName[src.slice(6).toLowerCase()] ?? null;
  return src;
}
