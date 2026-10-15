// File d'attente des envois en cas de coupure wifi courte.
// Les demandes restent uniquement en mémoire (jamais dans le stockage de la tablette) et sont
// renvoyées automatiquement au retour du réseau, dans l'ordre d'arrivée.

import { NetworkError } from './api/types';

type Job = { id: number; run: () => Promise<unknown>; tries: number };

const jobs: Job[] = [];
let seq = 0;
let flushing = false;
const listeners = new Set<(pending: number) => void>();

function notify() {
  for (const l of listeners) l(jobs.length);
}

export function onQueueChange(cb: (pending: number) => void): () => void {
  listeners.add(cb);
  cb(jobs.length);
  return () => listeners.delete(cb);
}

export function pendingCount(): number {
  return jobs.length;
}

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  flushing = true;
  try {
    while (jobs.length > 0) {
      const job = jobs[0];
      try {
        await job.run();
        jobs.shift();
        notify();
      } catch (e) {
        if (e instanceof NetworkError) break; // toujours hors ligne : on retentera plus tard
        // Erreur définitive (données refusées par le serveur) : on abandonne cette demande.
        job.tries++;
        jobs.shift();
        notify();
      }
    }
  } finally {
    flushing = false;
  }
}

/**
 * Exécute l'envoi tout de suite. En cas de coupure réseau, il est mis en file d'attente
 * et la fonction renvoie `queued`.
 */
export async function sendOrQueue<T>(run: () => Promise<T>): Promise<{ status: 'sent'; result: T } | { status: 'queued' }> {
  try {
    const result = await run();
    return { status: 'sent', result };
  } catch (e) {
    if (e instanceof NetworkError) {
      jobs.push({ id: ++seq, run, tries: 0 });
      notify();
      return { status: 'queued' };
    }
    throw e;
  }
}

/** Branche les relances : au retour du réseau et toutes les 20 secondes. */
export function startQueueWorker(): () => void {
  const onOnline = () => void flushQueue();
  window.addEventListener('online', onOnline);
  const timer = setInterval(() => {
    if (jobs.length > 0) void flushQueue();
  }, 20000);
  return () => {
    window.removeEventListener('online', onOnline);
    clearInterval(timer);
  };
}
