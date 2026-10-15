// Moteur de la Battle multijoueur, indépendant de React (testé unitairement).
//
// Fonctionnement :
//  * Chaque tablette publie sa présence sur le canal "cutshop-battle".
//  * L'hôte publie une Battle ouverte dans sa présence : les autres tablettes voient l'invitation
//    pendant 30 secondes et rejoignent en publiant le même identifiant de Battle.
//  * Le coordinateur (joueur encore connecté arrivé le plus tôt, l'hôte en général) diffuse le départ
//    avec les questions, puis les changements de phase. Si le coordinateur part, le suivant prend le relais.
//  * Chaque joueur diffuse ses réponses et son total. Les totaux ne font que croître : on fusionne en
//    gardant le plus grand, ce qui rend les classements cohérents même après une micro coupure.
//  * Un joueur qui quitte est marqué comme parti, la partie continue pour les autres.

import {
  LOBBY_MS,
  MAX_PLAYERS,
  MIN_PLAYERS,
  QUESTION_COUNT,
  QUESTION_MS,
  RESULT_MS,
  computePoints,
  mergeScore,
  pickQuestions,
  rankScores,
  type PlayQuestion,
  type ScoreEntry,
} from '../battle';
import type { QuizQuestion, QuizTheme } from '../types';
import type { BusChannel, PresenceMeta } from './bus';

export const BATTLE_EVENTS = ['battle_start', 'battle_phase', 'battle_answer', 'battle_ping'];
export const COUNTDOWN_MS = 3000;
const PING_MS = 2000;
const ALIVE_MS = 6500;
const FALLBACK_MS = 2500;

export type BattlePhase = 'idle' | 'lobby' | 'alone' | 'countdown' | 'question' | 'result' | 'podium';
export type BattleTheme = QuizTheme | 'mix';

export interface BattleInvite {
  battleId: string;
  hostKey: string;
  hostPseudo: string;
  hostTablet: string;
  lobbyEndsAt: number;
  theme: BattleTheme;
  players: number;
}

export interface LobbyPlayer {
  key: string;
  pseudo: string;
  tablet: string;
  joinedAt: number;
}

export interface MyAnswer {
  q: number;
  choice: number | null;
  points: number;
  correct: boolean;
  elapsed: number;
}

export interface BattleState {
  phase: BattlePhase;
  solo: boolean;
  battleId: string | null;
  isHost: boolean;
  pseudo: string;
  theme: BattleTheme;
  lobbyEndsAt: number;
  lobbyPlayers: LobbyPlayer[];
  players: LobbyPlayer[];
  questions: PlayQuestion[];
  q: number;
  phaseEndsAt: number;
  startAt: number;
  myAnswer: MyAnswer | null;
  answered: Record<string, boolean>;
  scores: Record<string, ScoreEntry>;
  gone: Record<string, boolean>;
  invite: BattleInvite | null;
  /** Une Battle tourne déjà entre d'autres tablettes. */
  busy: boolean;
  /** Message ponctuel à afficher (complet, déjà commencée...). */
  notice: 'full' | 'missed' | null;
}

export interface EngineDeps {
  channel: BusChannel;
  key: string;
  tablet: string;
  getQuestions: () => QuizQuestion[];
  now?: () => number;
  random?: () => number;
  tickMs?: number;
}

const PHASE_ORDER: Record<BattlePhase, number> = {
  idle: 0,
  lobby: 1,
  alone: 1,
  countdown: 2,
  question: 3,
  result: 4,
  podium: 9,
};

function initialState(): BattleState {
  return {
    phase: 'idle',
    solo: false,
    battleId: null,
    isHost: false,
    pseudo: '',
    theme: 'mix',
    lobbyEndsAt: 0,
    lobbyPlayers: [],
    players: [],
    questions: [],
    q: 0,
    phaseEndsAt: 0,
    startAt: 0,
    myAnswer: null,
    answered: {},
    scores: {},
    gone: {},
    invite: null,
    busy: false,
    notice: null,
  };
}

export class BattleEngine {
  private state: BattleState = initialState();
  private listeners = new Set<(s: BattleState) => void>();
  private presence: PresenceMeta[] = [];
  private lastSeen = new Map<string, number>();
  private startSender: { joinedAt: number; key: string } | null = null;
  private questionStartedAt = 0;
  private lastPhaseMsgAt = 0;
  private lastPingAt = 0;
  private joinedAt = 0;
  private dismissedInvite: string | null = null;
  private timer: ReturnType<typeof setInterval>;
  private unsubs: (() => void)[] = [];
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private deps: EngineDeps) {
    this.now = deps.now ?? (() => Date.now());
    this.random = deps.random ?? Math.random;
    const ch = deps.channel;
    this.unsubs.push(ch.onPresence((metas) => this.onPresence(metas)));
    this.unsubs.push(ch.on('battle_start', (p) => this.onStart(p)));
    this.unsubs.push(ch.on('battle_phase', (p) => this.onPhase(p)));
    this.unsubs.push(ch.on('battle_answer', (p) => this.onAnswer(p)));
    this.unsubs.push(ch.on('battle_ping', (p) => this.onPing(p)));
    this.publishPresence();
    this.timer = setInterval(() => this.tick(), deps.tickMs ?? 200);
  }

  // ---------------------------------------------------------------- abonnement
  getState(): BattleState {
    return this.state;
  }

  subscribe(cb: (s: BattleState) => void): () => void {
    this.listeners.add(cb);
    cb(this.state);
    return () => this.listeners.delete(cb);
  }

  private set(patch: Partial<BattleState>) {
    this.state = { ...this.state, ...patch };
    for (const l of this.listeners) l(this.state);
  }

  destroy() {
    clearInterval(this.timer);
    this.unsubs.forEach((u) => u());
    this.listeners.clear();
  }

  // ---------------------------------------------------------------- présence
  private publishPresence() {
    const s = this.state;
    const meta: Record<string, unknown> = { tablet: this.deps.tablet };
    if (s.battleId && !s.solo && s.phase !== 'idle') {
      meta.battleId = s.battleId;
      meta.pseudo = s.pseudo;
      meta.joinedAt = this.joinedAt;
      meta.role = s.isHost ? 'host' : 'player';
      meta.stage = s.phase === 'lobby' ? 'lobby' : s.phase === 'alone' ? 'alone' : s.phase === 'podium' ? 'done' : 'game';
      if (s.isHost) {
        meta.lobbyEndsAt = s.lobbyEndsAt;
        meta.theme = s.theme;
      }
    }
    this.deps.channel.track(meta);
  }

  private onPresence(metas: PresenceMeta[]) {
    this.presence = metas;
    const now = this.now();
    for (const m of metas) if (m.battleId) this.lastSeen.set(m.key, now);
    this.recompute();
  }

  /** Recalcule invitation, joueurs du lobby et indicateur « Battle en cours ». */
  private recompute() {
    const s = this.state;
    const now = this.now();
    const others = this.presence.filter((m) => m.key !== this.deps.key);

    // Invitation : un hôte d'une autre tablette avec un lobby encore ouvert.
    let invite: BattleInvite | null = null;
    if (s.phase === 'idle' || s.phase === 'podium' || s.phase === 'alone') {
      const host = others.find(
        (m) => m.role === 'host' && m.stage === 'lobby' && typeof m.lobbyEndsAt === 'number' && (m.lobbyEndsAt as number) > now,
      );
      if (host && host.battleId !== this.dismissedInvite) {
        const count = this.presence.filter((m) => m.battleId === host.battleId).length;
        invite = {
          battleId: String(host.battleId),
          hostKey: host.key,
          hostPseudo: String(host.pseudo ?? ''),
          hostTablet: String(host.tablet ?? ''),
          lobbyEndsAt: host.lobbyEndsAt as number,
          theme: (host.theme as BattleTheme) ?? 'mix',
          players: count,
        };
      }
    }
    const busy = others.some((m) => m.stage === 'game' && m.battleId !== s.battleId);

    let lobbyPlayers = s.lobbyPlayers;
    if (s.battleId && (s.phase === 'lobby' || s.phase === 'alone')) {
      lobbyPlayers = this.presence
        .filter((m) => m.battleId === s.battleId)
        .map((m) => ({
          key: m.key,
          pseudo: String(m.pseudo ?? ''),
          tablet: String(m.tablet ?? ''),
          joinedAt: Number(m.joinedAt ?? 0),
        }))
        .sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key));
      if (!lobbyPlayers.some((p) => p.key === this.deps.key)) {
        lobbyPlayers.push({ key: this.deps.key, pseudo: s.pseudo, tablet: this.deps.tablet, joinedAt: this.joinedAt });
      }
    }

    // Joueurs partis pendant la partie.
    const gone: Record<string, boolean> = { ...s.gone };
    if (!s.solo && PHASE_ORDER[s.phase] >= PHASE_ORDER.countdown) {
      for (const p of s.players) {
        if (p.key === this.deps.key) continue;
        gone[p.key] = !this.isAlive(p.key, now);
      }
    }

    const changed =
      JSON.stringify(invite) !== JSON.stringify(s.invite) ||
      busy !== s.busy ||
      JSON.stringify(lobbyPlayers) !== JSON.stringify(s.lobbyPlayers) ||
      JSON.stringify(gone) !== JSON.stringify(s.gone);
    if (changed) this.set({ invite, busy, lobbyPlayers, gone });
  }

  private isAlive(key: string, now: number): boolean {
    if (key === this.deps.key) return true;
    const inPresence = this.presence.some((m) => m.key === key && m.battleId === this.state.battleId);
    const seen = this.lastSeen.get(key) ?? 0;
    return inPresence || now - seen < ALIVE_MS;
  }

  /** Le coordinateur est le joueur vivant arrivé le plus tôt. */
  isCoordinator(): boolean {
    const s = this.state;
    if (s.solo) return true;
    const now = this.now();
    const pool = PHASE_ORDER[s.phase] >= PHASE_ORDER.countdown ? s.players : s.lobbyPlayers;
    const alive = pool.filter((p) => this.isAlive(p.key, now));
    if (alive.length === 0) return true;
    const first = alive.slice().sort((a, b) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key))[0];
    return first.key === this.deps.key;
  }

  // ---------------------------------------------------------------- actions joueur
  /** Ouvre une Battle et invite les autres tablettes pendant 30 secondes. */
  host(pseudo: string, theme: BattleTheme) {
    const now = this.now();
    this.joinedAt = now;
    this.startSender = null;
    this.set({
      ...initialState(),
      phase: 'lobby',
      battleId: `b${now.toString(36)}${Math.floor(this.random() * 1e6).toString(36)}`,
      isHost: true,
      pseudo,
      theme,
      lobbyEndsAt: now + LOBBY_MS,
      invite: null,
      busy: this.state.busy,
    });
    this.publishPresence();
    this.recompute();
  }

  join(pseudo: string) {
    const inv = this.state.invite;
    if (!inv) return;
    if (inv.players >= MAX_PLAYERS) {
      this.set({ notice: 'full' });
      return;
    }
    this.joinedAt = this.now();
    this.startSender = null;
    this.set({
      ...initialState(),
      phase: 'lobby',
      battleId: inv.battleId,
      isHost: false,
      pseudo,
      theme: inv.theme,
      lobbyEndsAt: inv.lobbyEndsAt,
      busy: this.state.busy,
    });
    this.publishPresence();
    this.recompute();
  }

  dismissInvite() {
    this.dismissedInvite = this.state.invite?.battleId ?? null;
    this.set({ invite: null });
  }

  clearNotice() {
    this.set({ notice: null });
  }

  /** L'hôte peut lancer sans attendre la fin des 30 secondes dès qu'il y a 2 joueurs. */
  startNow() {
    const s = this.state;
    if (s.phase !== 'lobby' || s.lobbyPlayers.length < MIN_PLAYERS) return;
    if (this.isCoordinator()) this.launch();
  }

  /** Partie solo contre le chrono. */
  solo(pseudo: string, theme: BattleTheme) {
    const now = this.now();
    this.joinedAt = now;
    const me: LobbyPlayer = { key: this.deps.key, pseudo, tablet: this.deps.tablet, joinedAt: now };
    const seed = Math.floor(this.random() * 2 ** 31);
    const questions = pickQuestions(this.deps.getQuestions(), seed, theme, QUESTION_COUNT);
    this.set({
      ...initialState(),
      phase: 'countdown',
      solo: true,
      battleId: `s${now.toString(36)}`,
      isHost: true,
      pseudo,
      theme,
      players: [me],
      questions,
      startAt: now + COUNTDOWN_MS,
      phaseEndsAt: now + COUNTDOWN_MS,
      scores: { [me.key]: { id: me.key, pseudo, total: 0, time: 0, correct: 0 } },
      busy: this.state.busy,
    });
    this.publishPresence();
  }

  answer(choice: number) {
    const s = this.state;
    if (s.phase !== 'question' || s.myAnswer?.q === s.q) return;
    const question = s.questions[s.q];
    if (!question) return;
    const elapsed = this.now() - this.questionStartedAt;
    const correct = choice === question.correct;
    const points = computePoints(correct, elapsed);
    const prev = s.scores[this.deps.key] ?? { id: this.deps.key, pseudo: s.pseudo, total: 0, time: 0, correct: 0 };
    const mine: ScoreEntry = {
      ...prev,
      total: prev.total + points,
      time: prev.time + (correct ? elapsed : 0),
      correct: prev.correct + (correct ? 1 : 0),
    };
    this.set({
      myAnswer: { q: s.q, choice, points, correct, elapsed },
      answered: { ...s.answered, [`${s.q}:${this.deps.key}`]: true },
      scores: { ...s.scores, [this.deps.key]: mine },
    });
    if (!s.solo) {
      this.deps.channel.send('battle_answer', {
        battleId: s.battleId,
        key: this.deps.key,
        q: s.q,
        score: mine,
      });
    }
  }

  /** Quitte la Battle (ou la salle d'attente) et revient à l'état initial. */
  leave() {
    this.startSender = null;
    this.set({ ...initialState(), busy: this.state.busy });
    this.publishPresence();
    this.recompute();
  }

  // ---------------------------------------------------------------- départ
  private launch() {
    const s = this.state;
    const players = s.lobbyPlayers.slice(0, MAX_PLAYERS);
    const seed = Math.floor(this.random() * 2 ** 31);
    const questions = pickQuestions(this.deps.getQuestions(), seed, s.theme, QUESTION_COUNT);
    const payload: StartPayload = {
      battleId: s.battleId ?? '',
      sender: { key: this.deps.key, joinedAt: this.joinedAt },
      players,
      questions,
      startIn: COUNTDOWN_MS,
    };
    this.deps.channel.send('battle_start', payload as unknown as Record<string, unknown>);
    this.applyStart(payload);
  }

  private onStart(p: Record<string, unknown>) {
    const s = this.state;
    if (p.battleId !== s.battleId || s.solo) return;
    this.applyStart(p as unknown as StartPayload);
  }

  private applyStart(p: StartPayload) {
    const s = this.state;
    if (PHASE_ORDER[s.phase] > PHASE_ORDER.countdown) return;
    // En cas de double départ simultané, on garde celui du joueur arrivé le plus tôt.
    if (this.startSender) {
      const cur = this.startSender;
      const earlier = p.sender.joinedAt < cur.joinedAt || (p.sender.joinedAt === cur.joinedAt && p.sender.key < cur.key);
      if (!earlier) return;
    }
    this.startSender = p.sender;
    if (!p.players.some((pl) => pl.key === this.deps.key)) {
      // Trop de joueurs : on n'a pas été retenu.
      this.set({ ...initialState(), notice: 'full', busy: true });
      this.publishPresence();
      return;
    }
    const now = this.now();
    const scores: Record<string, ScoreEntry> = {};
    for (const pl of p.players) scores[pl.key] = { id: pl.key, pseudo: pl.pseudo, total: 0, time: 0, correct: 0 };
    for (const pl of p.players) this.lastSeen.set(pl.key, now);
    this.set({
      phase: 'countdown',
      players: p.players,
      questions: p.questions,
      q: 0,
      startAt: now + p.startIn,
      phaseEndsAt: now + p.startIn,
      myAnswer: null,
      answered: {},
      scores,
      gone: {},
    });
    this.publishPresence();
  }

  // ---------------------------------------------------------------- phases
  private enterQuestion(q: number, endsAt: number) {
    this.questionStartedAt = this.now();
    this.set({ phase: 'question', q, phaseEndsAt: endsAt, myAnswer: this.state.myAnswer?.q === q ? this.state.myAnswer : null });
  }

  private broadcastPhase(phase: BattlePhase, q: number, durationMs: number) {
    if (this.state.solo) return;
    this.deps.channel.send('battle_phase', { battleId: this.state.battleId, phase, q, remaining: durationMs });
  }

  private onPhase(p: Record<string, unknown>) {
    const s = this.state;
    if (p.battleId !== s.battleId || s.solo) return;
    const phase = p.phase as BattlePhase;
    const q = Number(p.q);
    const remaining = Number(p.remaining);
    this.lastPhaseMsgAt = this.now();
    const ahead = q > s.q || (q === s.q && PHASE_ORDER[phase] > PHASE_ORDER[s.phase]);
    if (!ahead) {
      if (q === s.q && phase === s.phase) this.set({ phaseEndsAt: this.now() + remaining });
      return;
    }
    const endsAt = this.now() + remaining;
    if (phase === 'question') this.enterQuestion(q, endsAt);
    else if (phase === 'result') this.set({ phase: 'result', q, phaseEndsAt: endsAt });
    else if (phase === 'podium') this.set({ phase: 'podium', q, phaseEndsAt: 0 });
  }

  private onAnswer(p: Record<string, unknown>) {
    const s = this.state;
    if (p.battleId !== s.battleId) return;
    const key = String(p.key);
    this.lastSeen.set(key, this.now());
    const score = p.score as ScoreEntry;
    this.set({
      answered: { ...s.answered, [`${Number(p.q)}:${key}`]: true },
      scores: { ...s.scores, [key]: mergeScore(s.scores[key], score) },
    });
  }

  private onPing(p: Record<string, unknown>) {
    const s = this.state;
    if (p.battleId !== s.battleId) return;
    const key = String(p.key);
    this.lastSeen.set(key, this.now());
    const score = p.score as ScoreEntry | undefined;
    if (score) {
      const merged = mergeScore(s.scores[key], score);
      if (merged !== s.scores[key]) this.set({ scores: { ...s.scores, [key]: merged } });
    }
    const answeredQ = Number(p.answeredQ);
    if (!Number.isNaN(answeredQ) && answeredQ >= 0 && !s.answered[`${answeredQ}:${key}`]) {
      this.set({ answered: { ...this.state.answered, [`${answeredQ}:${key}`]: true } });
    }
  }

  private allAliveAnswered(): boolean {
    const s = this.state;
    const now = this.now();
    return s.players.filter((p) => this.isAlive(p.key, now)).every((p) => s.answered[`${s.q}:${p.key}`]);
  }

  // ---------------------------------------------------------------- horloge
  private tick() {
    const s = this.state;
    const now = this.now();
    if (s.phase === 'idle' || s.phase === 'podium') {
      if (s.invite && s.invite.lobbyEndsAt <= now) this.recompute();
      return;
    }

    if (s.phase === 'lobby') {
      this.recompute();
      const st = this.state;
      const full = st.lobbyPlayers.length >= MAX_PLAYERS;
      if ((now >= st.lobbyEndsAt || full) && this.isCoordinator()) {
        if (st.lobbyPlayers.length >= MIN_PLAYERS) this.launch();
        else {
          this.set({ phase: 'alone' });
          this.publishPresence();
        }
      } else if (now >= st.lobbyEndsAt + 4000 && st.phase === 'lobby') {
        // Le départ n'est jamais arrivé (hôte parti) : on se retrouve seul.
        this.set({ phase: 'alone' });
        this.publishPresence();
      }
      return;
    }
    if (s.phase === 'alone') return;

    // Partie en cours : battement de coeur pour la détection des départs.
    if (!s.solo && now - this.lastPingAt >= PING_MS) {
      this.lastPingAt = now;
      const lastAnswered = s.myAnswer ? s.myAnswer.q : -1;
      this.deps.channel.send('battle_ping', {
        battleId: s.battleId,
        key: this.deps.key,
        score: s.scores[this.deps.key],
        answeredQ: lastAnswered,
      });
    }
    if (!s.solo) this.recompute();

    const coordinator = this.isCoordinator();
    const late = now >= s.phaseEndsAt + FALLBACK_MS && now - this.lastPhaseMsgAt >= FALLBACK_MS;

    if (s.phase === 'countdown') {
      if (now >= s.startAt) {
        // Le départ est daté : chaque tablette passe seule à la première question.
        this.enterQuestion(0, s.startAt + QUESTION_MS);
      }
      return;
    }
    if (s.phase === 'question') {
      const done = now >= s.phaseEndsAt || this.allAliveAnswered();
      if ((coordinator && done) || late) {
        this.set({ phase: 'result', phaseEndsAt: now + RESULT_MS });
        if (coordinator) this.broadcastPhase('result', s.q, RESULT_MS);
      }
      return;
    }
    if (s.phase === 'result') {
      if ((coordinator && now >= s.phaseEndsAt) || late) {
        const next = s.q + 1;
        if (next < s.questions.length) {
          this.enterQuestion(next, now + QUESTION_MS);
          if (coordinator) this.broadcastPhase('question', next, QUESTION_MS);
        } else {
          this.set({ phase: 'podium', phaseEndsAt: 0 });
          if (coordinator) this.broadcastPhase('podium', s.q, 0);
          this.publishPresence();
        }
      }
    }
  }

  // ---------------------------------------------------------------- lecture
  ranking(): ScoreEntry[] {
    const s = this.state;
    const entries = s.players.map((p) => ({
      ...(s.scores[p.key] ?? { id: p.key, pseudo: p.pseudo, total: 0, time: 0, correct: 0 }),
      pseudo: p.pseudo,
      gone: Boolean(s.gone[p.key]),
    }));
    return rankScores(entries);
  }
}

interface StartPayload {
  battleId: string;
  sender: { key: string; joinedAt: number };
  players: LobbyPlayer[];
  questions: PlayQuestion[];
  startIn: number;
}
