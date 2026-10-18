import { describe, expect, it } from 'vitest';
import { isPlausible } from '../../validation';
import { BeatEngine, EARLY_MISS_MS, judge } from './engine';
import { clampOffset, median } from './offset';
import {
  BEAT_DIFFICULTIES,
  BEAT_MS,
  beatMaxScore,
  buildBeatmap,
  comboMultiplier,
  GOOD_MS,
  judgementCount,
  LANES,
  LEAD_IN_BARS,
  maxScoreForMap,
  MIN_LANE_GAP_MS,
  PERFECT_MS,
  SONGS,
  songForSeed,
  stepMs,
  type BeatDifficulty,
} from './songs';

const START = 1_000_000;

/** Graine qui sélectionne le morceau d'indice donné. */
const seedFor = (songIndex: number) => 300 + songIndex;

interface Action {
  t: number;
  lane: number;
  down: boolean;
}

/** Joueur simulé : appuie avec un décalage donné, relâche les notes longues à la fin (plus un décalage). */
function play(e: BeatEngine, pressShift: number, releaseShift = 0, skip: (i: number) => boolean = () => false) {
  const actions: Action[] = [];
  e.notes.forEach((n, i) => {
    if (skip(i)) return;
    actions.push({ t: START + n.t + pressShift, lane: n.lane, down: true });
    actions.push({ t: START + n.t + (n.len > 0 ? n.len + releaseShift : 40 + pressShift), lane: n.lane, down: false });
  });
  actions.sort((a, b) => a.t - b.t || Number(a.down) - Number(b.down));
  for (const a of actions) {
    e.update(a.t);
    if (a.down) e.press(a.lane, a.t);
    else e.release(a.lane, a.t);
  }
  e.update(START + BEAT_MS);
  return e.result();
}

describe('Beat Drop : morceaux et beatmaps', () => {
  it('produit des beatmaps déterministes, triées, sur des pistes valides', () => {
    for (const song of SONGS) {
      for (const d of BEAT_DIFFICULTIES) {
        const a = buildBeatmap(song, d);
        expect(buildBeatmap(song, d)).toEqual(a);
        expect(a.length).toBeGreaterThan(40);
        for (let i = 0; i < a.length; i++) {
          const n = a[i];
          expect(n.lane).toBeGreaterThanOrEqual(0);
          expect(n.lane).toBeLessThan(LANES);
          expect(n.len).toBeGreaterThanOrEqual(0);
          if (i > 0) expect(n.t).toBeGreaterThanOrEqual(a[i - 1].t);
        }
      }
    }
  });

  it('respecte l’écart minimal par piste (notes longues comprises), l’intro et la fin', () => {
    for (const song of SONGS) {
      for (const d of BEAT_DIFFICULTIES) {
        const map = buildBeatmap(song, d);
        const lastEnd = new Array<number>(LANES).fill(-Infinity);
        for (const n of map) {
          expect(n.t - lastEnd[n.lane]).toBeGreaterThanOrEqual(MIN_LANE_GAP_MS);
          lastEnd[n.lane] = n.t + n.len;
          expect(map.filter((o) => o.t === n.t).length).toBeLessThanOrEqual(2);
        }
        expect(map[0].t).toBeGreaterThanOrEqual(Math.round(LEAD_IN_BARS * 16 * stepMs(song)));
        expect(Math.max(...map.map((n) => n.t + n.len))).toBeLessThanOrEqual(BEAT_MS - 1500);
      }
    }
  });

  it('reste jouable : densité croissante avec la difficulté, au plus 10 notes par seconde', () => {
    for (const song of SONGS) {
      const counts = BEAT_DIFFICULTIES.map((d) => buildBeatmap(song, d).length);
      expect(counts[0]).toBeLessThan(counts[1]);
      expect(counts[1]).toBeLessThan(counts[2]);
      for (const d of BEAT_DIFFICULTIES) {
        const map = buildBeatmap(song, d);
        // Fenêtre glissante d'une seconde.
        let j = 0;
        for (let i = 0; i < map.length; i++) {
          while (map[i].t - map[j].t >= 1000) j++;
          expect(i - j + 1).toBeLessThanOrEqual(10);
        }
      }
    }
  });

  it('choisit le même morceau pour une même graine', () => {
    expect(songForSeed(42)).toBe(songForSeed(42));
    expect(new Set(SONGS.map((_, i) => songForSeed(seedFor(i)).id)).size).toBe(SONGS.length);
  });

  it('fige les plafonds codés en dur côté serveur', () => {
    expect(beatMaxScore('easy')).toBe(47200);
    expect(beatMaxScore('medium')).toBe(124000);
    expect(beatMaxScore('hard')).toBe(157200);
  });
});

describe('Beat Drop : moteur', () => {
  it('note PERFECT et GOOD selon l’écart', () => {
    expect(judge(0)).toBe('perfect');
    expect(judge(-PERFECT_MS)).toBe('perfect');
    expect(judge(PERFECT_MS + 1)).toBe('good');
    expect(judge(-GOOD_MS)).toBe('good');
    expect(judge(GOOD_MS + 1)).toBeNull();
    expect(comboMultiplier(0)).toBe(1);
    expect(comboMultiplier(10)).toBe(2);
    expect(comboMultiplier(39)).toBe(4);
    expect(comboMultiplier(500)).toBe(4);
  });

  it('un joueur parfait atteint exactement le score maximal de chaque beatmap (et beatMaxScore)', () => {
    for (const d of BEAT_DIFFICULTIES) {
      let best = 0;
      SONGS.forEach((song, i) => {
        const e = new BeatEngine(seedFor(i), d);
        expect(e.song.id).toBe(song.id);
        e.start(START);
        const r = play(e, 0);
        const map = buildBeatmap(song, d);
        expect(r.score).toBe(maxScoreForMap(map));
        expect(r.stats.perfect).toBe(judgementCount(map));
        expect(r.stats.miss).toBe(0);
        expect(r.stats.judgements).toBe(judgementCount(map));
        expect(r.stats.maxCombo).toBe(judgementCount(map));
        expect(isPlausible('beat', d, r)).toBe(true);
        best = Math.max(best, r.score);
      });
      expect(best).toBe(beatMaxScore(d));
    }
  });

  it('applique la calibration de la tablette au jugement', () => {
    const late = new BeatEngine(seedFor(0), 'medium', 90);
    late.start(START);
    const r = play(late, 90, 90);
    expect(r.stats.perfect).toBe(r.stats.judgements);
    const raw = new BeatEngine(seedFor(0), 'medium', 0);
    raw.start(START);
    expect(play(raw, 90, 90).stats.perfect).toBe(0);
  });

  it('un joueur un peu en retard ne fait que des GOOD sur les attaques', () => {
    const e = new BeatEngine(seedFor(2), 'hard');
    e.start(START);
    const r = play(e, 100);
    const longs = e.notes.filter((n) => n.len > 0).length;
    expect(r.stats.good).toBe(e.notes.length);
    expect(r.stats.perfect).toBe(longs);
    expect(r.stats.miss).toBe(0);
    expect(r.score).toBeLessThan(beatMaxScore('hard'));
    expect(isPlausible('beat', 'hard', r)).toBe(true);
  });

  it('sans aucun appui, tout est raté et le score reste nul', () => {
    const e = new BeatEngine(seedFor(1), 'easy');
    e.start(START);
    for (let t = START; t <= START + BEAT_MS; t += 16) e.update(t);
    const r = e.result();
    expect(r.score).toBe(0);
    expect(r.stats.miss).toBe(r.stats.judgements);
    expect(e.isOver(START + BEAT_MS)).toBe(true);
    expect(isPlausible('beat', 'easy', r)).toBe(true);
  });

  it('un appui trop tôt rate la note, un relâché trop tôt rate la fin de note longue', () => {
    const e = new BeatEngine(seedFor(0), 'hard');
    e.start(START);
    const first = e.notes[0];
    e.press(first.lane, START + first.t - (GOOD_MS + EARLY_MISS_MS) / 2);
    expect(first.head).toBe('miss');
    const long = e.notes.find((n) => n.len > 0)!;
    e.update(START + long.t - 1);
    e.press(long.lane, START + long.t);
    expect(long.head).toBe('perfect');
    expect(e.combo).toBe(1);
    e.release(long.lane, START + long.t + long.len - GOOD_MS - 20);
    expect(long.tail).toBe('miss');
    expect(e.combo).toBe(0);
  });

  it('ignore les appuis avant le départ et les pistes invalides', () => {
    const e = new BeatEngine(seedFor(0), 'easy');
    e.start(START);
    e.press(0, START - 10);
    e.press(7, START + 10);
    e.update(START + 100);
    expect(e.result().stats.perfect + e.result().stats.good + e.result().stats.miss).toBe(0);
  });

  it('le martèlement au hasard ne paie pas', () => {
    for (const d of BEAT_DIFFICULTIES as readonly BeatDifficulty[]) {
      const e = new BeatEngine(seedFor(2), d);
      e.start(START);
      for (let t = START; t < START + BEAT_MS; t += 70) {
        for (let lane = 0; lane < LANES; lane++) {
          e.press(lane, t);
          e.release(lane, t + 30);
        }
      }
      e.finish(START + BEAT_MS);
      const r = e.result();
      expect(r.score).toBeLessThan(beatMaxScore(d) * 0.35);
      expect(isPlausible('beat', d, r)).toBe(true);
    }
  });

  it('se termine à la durée prévue avec des statistiques complètes', () => {
    const e = new BeatEngine(seedFor(1), 'medium');
    e.start(START);
    play(e, 0, 0, (i) => i % 3 === 0);
    expect(e.isOver(START + BEAT_MS - 1)).toBe(true);
    const s = e.result().stats;
    expect(s.perfect + s.good + s.miss).toBe(s.judgements);
    expect(s.miss).toBeGreaterThan(0);
    expect(e.result().durationMs).toBe(BEAT_MS);
    // Après la fin, plus rien ne bouge.
    const score = e.score;
    e.press(0, START + BEAT_MS + 10);
    expect(e.score).toBe(score);
  });

  it('abandon en cours de partie : statistiques cohérentes', () => {
    const e = new BeatEngine(seedFor(0), 'hard');
    e.start(START);
    e.finish(START + 20000);
    const s = e.result().stats;
    expect(s.perfect + s.good + s.miss).toBe(s.judgements);
  });

  it('calibration : médiane et bornes', () => {
    expect(median([30, 10, 500, 20, 25])).toBe(25);
    expect(median([1, 3])).toBe(2);
    expect(clampOffset(900)).toBe(250);
    expect(clampOffset(Number.NaN)).toBe(0);
  });
});
