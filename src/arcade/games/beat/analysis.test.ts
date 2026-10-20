import { describe, expect, it } from 'vitest';
import { analyzeTrack, maxJudgements, shiftChart, suggestStart } from './analysis';
import { BEAT_DIFFICULTIES, BEAT_MS, beatMaxScore, END_MARGIN_MS, judgementCount, LANES, maxScoreForMap, MIN_LANE_GAP_MS } from './songs';
import { chartFromCompact, setBeatTracks, toCompact, beatTrackForSeed, beatTracks } from './tracks';
import { BeatEngine } from './engine';

const SR = 22050;

/** Morceau de synthèse : grosse caisse sur chaque temps, caisse claire sur 2 et 4, charleston en croches, nappe tenue. */
function synthSong(bpm: number, firstBeat: number, seconds = BEAT_MS / 1000) {
  const n = Math.floor(seconds * SR);
  const out = new Float32Array(n);
  let rnd = 12345;
  const noise = () => {
    rnd = (Math.imul(rnd, 1664525) + 1013904223) >>> 0;
    return rnd / 2147483648 - 1;
  };
  const beat = 60 / bpm;
  const events: { t: number; kind: 'kick' | 'snare' | 'hat' }[] = [];
  for (let k = 0; firstBeat + k * beat < seconds - 0.5; k++) {
    const t = firstBeat + k * beat;
    events.push({ t, kind: 'kick' });
    if (k % 2 === 1) events.push({ t, kind: 'snare' });
    events.push({ t: t + beat / 2, kind: 'hat' });
  }
  for (const e of events) {
    const i0 = Math.round(e.t * SR);
    const len = Math.round((e.kind === 'kick' ? 0.25 : e.kind === 'snare' ? 0.18 : 0.05) * SR);
    for (let i = 0; i < len && i0 + i < n; i++) {
      const t = i / SR;
      let v = 0;
      if (e.kind === 'kick') v = Math.sin(2 * Math.PI * (55 + 90 * Math.exp(-t * 30)) * t) * Math.exp(-t * 14) * 0.9;
      else if (e.kind === 'snare') v = (noise() * 0.6 + Math.sin(2 * Math.PI * 1800 * t) * 0.2) * Math.exp(-t * 22);
      else v = noise() * 0.25 * Math.exp(-t * 80);
      out[i0 + i] += v;
    }
  }
  for (let i = 0; i < n; i++) out[i] += 0.05 * Math.sin((2 * Math.PI * 220 * i) / SR);
  return { pcm: out, events };
}

describe('Beat Drop : analyse des musiques importées', () => {
  const bpm = 124;
  const first = 0.37;
  const { pcm, events } = synthSong(bpm, first);
  const a = analyzeTrack([pcm], SR);

  it('retrouve le tempo et le premier temps', () => {
    expect(Math.abs(a.bpm - bpm)).toBeLessThan(0.3);
    const beatMs = 60000 / bpm;
    const phaseErr = Math.abs(((a.beatPhaseMs - first * 1000) % beatMs + beatMs) % beatMs);
    expect(Math.min(phaseErr, beatMs - phaseErr)).toBeLessThan(12);
  });

  it('place chaque note sur un vrai son (à 15 ms près)', () => {
    const times = events.map((e) => e.t * 1000);
    for (const d of BEAT_DIFFICULTIES) {
      for (const note of a.charts[d]) {
        const nearest = Math.min(...times.map((t) => Math.abs(t - note.t)));
        expect(nearest).toBeLessThan(15);
      }
    }
  });

  it('respecte la densité, les pistes, les marges et le plafond de score de chaque niveau', () => {
    const counts = BEAT_DIFFICULTIES.map((d) => judgementCount(a.charts[d]));
    expect(counts[0]).toBeGreaterThan(60);
    expect(counts[0]).toBeLessThan(counts[1]);
    expect(counts[1]).toBeLessThan(counts[2]);
    for (const d of BEAT_DIFFICULTIES) {
      const map = a.charts[d];
      expect(judgementCount(map)).toBeLessThanOrEqual(maxJudgements(d));
      expect(maxScoreForMap(map)).toBeLessThanOrEqual(beatMaxScore(d));
      expect(map[0].t).toBeGreaterThanOrEqual(1500);
      for (const n of map) {
        expect(n.lane).toBeGreaterThanOrEqual(0);
        expect(n.lane).toBeLessThan(LANES);
        expect(n.t + n.len).toBeLessThanOrEqual(BEAT_MS - END_MARGIN_MS);
      }
      for (let lane = 0; lane < LANES; lane++) {
        const ln = map.filter((n) => n.lane === lane);
        for (let i = 1; i < ln.length; i++) expect(ln[i].t - (ln[i - 1].t + ln[i - 1].len)).toBeGreaterThanOrEqual(MIN_LANE_GAP_MS);
      }
      // Les quatre pistes servent (sauf en FACILE où deux pistes peuvent suffire).
      expect(new Set(map.map((n) => n.lane)).size).toBeGreaterThanOrEqual(d === 'easy' ? 2 : 3);
    }
  });

  it('relit une partition stockée, refuse les notes invalides et plafonne le score', () => {
    const stored = toCompact(a.charts.hard);
    expect(chartFromCompact(stored, 'hard')).toEqual(a.charts.hard);
    expect(chartFromCompact([[1000, 9, 0], ['x', 1, 0], [2000, 1, 0]], 'easy')).toEqual([{ t: 2000, lane: 1, len: 0 }]);
    const dense = Array.from({ length: 600 }, (_, i) => [2000 + i * 100, i % 4, 0]);
    expect(maxScoreForMap(chartFromCompact(dense, 'easy'))).toBeLessThanOrEqual(beatMaxScore('easy'));
  });

  it('décale une partition sans sortir de la partie', () => {
    const moved = shiftChart(a.charts.medium, 40);
    expect(moved[0].t).toBe(a.charts.medium[0].t + 40);
    expect(Math.max(...moved.map((n) => n.t + n.len))).toBeLessThanOrEqual(BEAT_MS - END_MARGIN_MS);
  });

  it('propose l’extrait le plus énergique', () => {
    const quiet = new Float32Array(SR * 100);
    quiet.set(pcm.subarray(0, SR * 60), SR * 30);
    expect(suggestStart(quiet, SR, 60)).toBeGreaterThanOrEqual(29);
    expect(suggestStart(quiet, SR, 60)).toBeLessThanOrEqual(31);
  });

  it('joue un morceau importé : même morceau pour la même graine, partie parfaite au score maximal', () => {
    const row = (id: string) => ({
      id,
      title: `Titre ${id}`,
      artist: 'Artiste',
      cover_url: null,
      audio_url: `https://example.test/${id}.mp3`,
      bpm: a.bpm,
      beat_phase_ms: a.beatPhaseMs,
      charts: { easy: toCompact(a.charts.easy), medium: toCompact(a.charts.medium), hard: toCompact(a.charts.hard) },
      active: true,
      sort: 0,
    });
    setBeatTracks([row('b'), row('a'), { ...row('c'), active: false }]);
    expect(beatTracks().map((t) => t.id)).toEqual(['a', 'b']);
    expect(beatTrackForSeed(42)?.id).toBe(beatTrackForSeed(42)?.id);

    const engine = new BeatEngine(42, 'hard', 0, BEAT_MS, 'b');
    expect(engine.track?.id).toBe('b');
    engine.start(0);
    for (const n of engine.notes) {
      engine.press(n.lane, n.t);
      if (n.len > 0) engine.release(n.lane, n.t + n.len);
      else engine.release(n.lane, n.t + 30);
    }
    engine.finish(BEAT_MS);
    expect(engine.result().score).toBe(maxScoreForMap(a.charts.hard));
    expect(engine.result().score).toBeLessThanOrEqual(beatMaxScore('hard'));
    setBeatTracks([]);
    expect(new BeatEngine(42, 'hard').track).toBeNull();
  });
});
