// Typographie française : espace insécable avant ? ! : ; » et après «,
// pour qu'un signe ne se retrouve jamais seul en début de ligne.
export function frenchTypo(text: string): string {
  return text.replace(/ ([?!:;»])/g, ' $1').replace(/« /g, '« ');
}
