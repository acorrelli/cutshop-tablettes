// Petits sons générés (aucun fichier audio) : cliquetis de la roue et jingles.

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** À appeler dans un geste utilisateur pour autoriser le son sur Android. */
export function unlockAudio(): void {
  audio();
}

export function tick(volume = 0.18): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1900, t);
  osc.frequency.exponentialRampToValueAtTime(700, t + 0.025);
  gain.gain.setValueAtTime(volume, t);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  osc.connect(gain).connect(a.destination);
  osc.start(t);
  osc.stop(t + 0.05);
}

export function chime(win: boolean): void {
  const a = audio();
  if (!a) return;
  const notes = win ? [523.25, 659.25, 783.99, 1046.5] : [392, 329.63];
  notes.forEach((f, i) => {
    const t = a.currentTime + i * 0.12;
    const osc = a.createOscillator();
    const gain = a.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f, t);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.2, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(gain).connect(a.destination);
    osc.start(t);
    osc.stop(t + 0.4);
  });
}
