// Barber Rush : le joueur choisit le bon outil puis réalise le geste sur le client (tracé, taps, appui long).
// Le moteur (engine.ts) applique les règles ; ce composant gère l'affichage, la géométrie des gestes et les sons.
import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent } from 'react';
import { sfx } from '../../audio';
import type { GameProps } from '../types';
import { BEARD_WILD, ClientFace, NEAT, type CutState } from './ClientFace';
import { ARRIVE_MS, BarberEngine, DONE_MS, LEAVE_MS, TOOLS, type BarberEvent, type ProductKind, type Tool } from './engine';
import {
  BEARD_BRUSH,
  BEARD_CELLS,
  CLIP_BRUSH,
  CLIP_CELLS,
  CLIP_ZONES,
  CONTOUR_POINTS,
  CONTOUR_SEGMENTS,
  distToPoints,
  inBeardZone,
  inClipZone,
  polyPath,
  SNIP_POINTS,
  SNIP_RADIUS,
  type Pt,
} from './geometry';
import { PRODUCT_COLORS, ProductIcon, ToolIcon } from './icons';

const TXT = {
  fr: {
    order: 'PRESTATION DEMANDÉE',
    client: 'Client',
    patience: 'PATIENCE',
    tools: { clipper: 'Tondeuse', scissors: 'Ciseaux', razor: 'Contours', beard: 'Barbe', product: 'Produit', finish: 'Finition' },
    products: { wax: 'Cire', pomade: 'Pommade', oil: 'Huile', spray: 'Laque', clay: 'Argile' },
    pick: 'Choisis le bon outil',
    pickFirst: 'Choisis d’abord le bon outil',
    howTo: {
      clipper: 'Passe la tondeuse sur les deux côtés',
      scissors: 'Coupe les mèches dans l’ordre',
      razor: 'Suis la ligne pointillée avec précision',
      beard: 'Taille toute la barbe',
      product: 'Choisis le produit demandé',
      finish: 'Maintiens le miroir',
    },
    hold: 'MAINTIENS',
    perfect: 'PARFAIT !',
    nice: 'BIEN JOUÉ !',
    wrongTool: 'MAUVAIS OUTIL',
    penalty: 'Pénalité',
    miss: 'RATÉ',
    left: 'CLIENT PARTI !',
    precision: 'Précision',
    speed: 'Vitesse',
    streak: 'SÉRIE',
    served: 'SERVIS',
    perfects: 'PARFAITS',
    combo: 'MULTIPLICATEUR x2 !',
    next: 'Client suivant',
    closed: 'SALON COMPLET !',
    welcome: 'Bienvenue !',
  },
  en: {
    order: 'REQUESTED CUT',
    client: 'Client',
    patience: 'PATIENCE',
    tools: { clipper: 'Clipper', scissors: 'Scissors', razor: 'Razor', beard: 'Beard', product: 'Product', finish: 'Finish' },
    products: { wax: 'Wax', pomade: 'Pomade', oil: 'Oil', spray: 'Spray', clay: 'Clay' },
    pick: 'Pick the right tool',
    pickFirst: 'Pick the right tool first',
    howTo: {
      clipper: 'Run the clipper over both sides',
      scissors: 'Snip the strands in order',
      razor: 'Trace the dotted line precisely',
      beard: 'Trim the whole beard',
      product: 'Pick the requested product',
      finish: 'Hold the mirror',
    },
    hold: 'HOLD',
    perfect: 'PERFECT!',
    nice: 'NICE CUT!',
    wrongTool: 'WRONG TOOL',
    penalty: 'Penalty',
    miss: 'MISSED',
    left: 'CLIENT LEFT!',
    precision: 'Precision',
    speed: 'Speed',
    streak: 'STREAK',
    served: 'SERVED',
    perfects: 'PERFECT',
    combo: 'MULTIPLIER x2!',
    next: 'Next client',
    closed: 'SHOP IS FULL!',
    welcome: 'Welcome!',
  },
};

const NEON = '#39f5a6';
const GOLD = '#D4A84B';
const RED = '#ff4d6d';

interface Popup {
  id: number;
  at: number;
  big: string;
  small?: string;
  detail?: string;
  color: string;
  size: 'xl' | 'md' | 'sm';
  /** Décalage vertical en pixels sous la ligne des messages. */
  y?: number;
}

/** État local du geste de l'étape en cours (réinitialisé à chaque étape). */
interface Gesture {
  key: string;
  covered: Set<number>;
  inside: number;
  total: number;
  trails: Pt[][];
  pointers: Map<number, number>;
  /** Traits conservés pour les masques du dessin (tondeuse, barbe), par client. */
  clip: Pt[][];
  beard: Pt[][];
  clientKey: number;
  ver: number;
}

const ease = (t: number) => 1 - (1 - Math.min(1, Math.max(0, t))) ** 3;

export default function BarberRush(props: GameProps) {
  const T = TXT[props.lang] ?? TXT.fr;
  const engine = useMemo(() => {
    const e = new BarberEngine(props.seed, props.durationMs);
    e.start(props.startAt);
    return e;
  }, [props.seed]);
  const P = useRef(props);
  P.current = props;
  const [, setTick] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
  const popups = useRef<Popup[]>([]);
  const popupId = useRef(0);
  const toolFlash = useRef<{ tool: Tool; at: number; ok: boolean } | null>(null);
  const hintAt = useRef(-1e9);
  const lastClipSfx = useRef(0);
  const ended = useRef(false);
  const g = useRef<Gesture>({
    key: '',
    covered: new Set(),
    inside: 0,
    total: 0,
    trails: [],
    pointers: new Map(),
    clip: [],
    beard: [],
    clientKey: -1,
    ver: 0,
  });

  const now0 = props.clock();
  const nowRef = useRef(now0);

  // Boucle d'animation : avance le moteur, traite ses événements, signale le score et la fin.
  useEffect(() => {
    let raf = 0;
    let lastScore = -1;
    const push = (p: Omit<Popup, 'id'>) => {
      popups.current.push({ ...p, id: ++popupId.current });
      if (popups.current.length > 5) popups.current.shift();
    };
    const handle = (ev: BarberEvent) => {
      const { sound } = P.current;
      const t = TXT[P.current.lang] ?? TXT.fr;
      switch (ev.type) {
        case 'wrongTool':
          sfx('bad', sound);
          push({ at: ev.at, big: t.wrongTool, small: `${t.penalty} ${ev.penalty}`, color: RED, size: 'md' });
          break;
        case 'miss':
          sfx('tick', sound);
          push({ at: ev.at, big: t.miss, color: RED, size: 'sm' });
          break;
        case 'hit':
          sfx('snip', sound);
          break;
        case 'step':
          sfx(ev.tool === 'scissors' ? 'snip' : 'good', sound);
          break;
        case 'served': {
          sfx(ev.perfect ? 'perfect' : 'good', sound);
          const detail = `${t.precision} +${ev.precision}  ·  ${t.speed} +${ev.speed}${ev.multiplier > 1 ? '  ·  x2' : ''}`;
          push({ at: ev.at, big: ev.perfect ? t.perfect : t.nice, small: `+${ev.points}`, detail, color: ev.perfect ? GOLD : NEON, size: 'xl' });
          if (engine.streak === 3) {
            sfx('combo', sound);
            push({ at: ev.at + 450, big: t.combo, color: GOLD, size: 'md', y: 230 });
          }
          break;
        }
        case 'left':
          sfx('bad', sound);
          push({ at: ev.at, big: t.left, small: `${t.penalty} ${ev.penalty}`, color: RED, size: 'xl' });
          break;
        default:
          break;
      }
    };
    const loop = () => {
      const p = P.current;
      const now = p.clock();
      nowRef.current = now;
      engine.update(now);
      for (const ev of engine.drain()) handle(ev);
      if (engine.score !== lastScore) {
        lastScore = engine.score;
        p.onLive(engine.score);
      }
      if (!ended.current && now >= p.startAt + p.durationMs) {
        ended.current = true;
        engine.finish(now);
        sfx('end', p.sound);
        p.onEnd(engine.result());
      }
      popups.current = popups.current.filter((x) => now - x.at < 1500);
      setTick((v) => (v + 1) % 1e6);
      if (!ended.current) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
    };
  }, [engine]);

  const now = nowRef.current;
  const spec = engine.spec;
  const phase = engine.phase;
  const step = engine.step;
  const gs = g.current;

  // Réinitialise le geste à chaque nouvelle étape, et les traits de coupe à chaque nouveau client.
  const stepKey = `${engine.index}:${engine.stepIndex}:${phase}`;
  if (gs.clientKey !== engine.index) {
    gs.clientKey = engine.index;
    gs.clip = [];
    gs.beard = [];
    gs.ver++;
  }
  if (gs.key !== stepKey) {
    gs.key = stepKey;
    gs.covered = new Set();
    gs.inside = 0;
    gs.total = 0;
    gs.trails = [];
    gs.pointers.clear();
  }

  const toSvg = (e: RPointerEvent): Pt | null => {
    const svg = svgRef.current;
    const m = svg?.getScreenCTM();
    if (!svg || !m) return null;
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const hint = (t: number) => {
    if (t - hintAt.current < 1600) return;
    hintAt.current = t;
    popups.current.push({ id: ++popupId.current, at: t, big: T.pickFirst, color: '#F4EBD9', size: 'sm' });
  };

  /** Ajoute un point au tracé en cours et transmet couverture et précision au moteur. */
  const addPoint = (pid: number, p: Pt, t: number) => {
    const s = engine.step;
    if (!s || engine.tool !== s) return;
    const ti = gs.pointers.get(pid);
    if (ti === undefined) return;
    const trail = gs.trails[ti];
    const prev = trail[trail.length - 1];
    trail.push(p);
    if (trail.length > 400) trail.splice(0, trail.length - 400);
    // Points intermédiaires : un geste rapide couvre aussi le chemin parcouru.
    const pts: Pt[] = [];
    if (prev) {
      const n = Math.max(1, Math.ceil(Math.hypot(p.x - prev.x, p.y - prev.y) / 4));
      for (let k = 1; k <= n; k++) pts.push({ x: prev.x + ((p.x - prev.x) * k) / n, y: prev.y + ((p.y - prev.y) * k) / n });
    } else pts.push(p);
    let coverage = 0;
    if (s === 'clipper' || s === 'beard') {
      const cells = s === 'clipper' ? CLIP_CELLS : BEARD_CELLS;
      const r = s === 'clipper' ? CLIP_BRUSH : BEARD_BRUSH;
      for (const q of pts) {
        gs.total++;
        if (s === 'clipper' ? inClipZone(q, 12) : inBeardZone(q, 14)) gs.inside++;
        cells.forEach((c, i) => {
          if (!gs.covered.has(i) && Math.abs(c.x - q.x) < r && Math.abs(c.y - q.y) < r && Math.hypot(c.x - q.x, c.y - q.y) < r) gs.covered.add(i);
        });
      }
      coverage = gs.covered.size / cells.length;
      if (t - lastClipSfx.current > 140) {
        lastClipSfx.current = t;
        sfx('clip', P.current.sound);
      }
    } else if (s === 'razor') {
      const path = CONTOUR_POINTS[spec.contour];
      const tol = spec.contourTol;
      for (const q of pts) {
        gs.total++;
        if (distToPoints(q, path) <= tol) gs.inside++;
        path.forEach((c, i) => {
          if (!gs.covered.has(i) && Math.hypot(c.x - q.x, c.y - q.y) <= tol + 6) gs.covered.add(i);
        });
      }
      coverage = gs.covered.size / path.length;
    }
    const precision = gs.total ? gs.inside / gs.total : 1;
    engine.stroke(t, coverage, precision);
    gs.ver++;
  };

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    const t = P.current.clock();
    if (t < P.current.startAt) return;
    engine.update(t);
    const s = engine.step;
    const p = toSvg(e);
    if (!s || !p) return;
    if (engine.tool !== s) {
      hint(t);
      return;
    }
    if (s === 'scissors') {
      const targets = spec.snips;
      let best = -1;
      let bd = Infinity;
      for (const a of targets) {
        const d = Math.hypot(SNIP_POINTS[a].x - p.x, SNIP_POINTS[a].y - p.y);
        if (d < bd) {
          bd = d;
          best = a;
        }
      }
      if (bd <= SNIP_RADIUS + 10) engine.snip(t, best);
      else if (bd <= SNIP_RADIUS * 3) engine.snip(t, -1);
      return;
    }
    if (s === 'clipper' || s === 'beard' || s === 'razor') {
      try {
        (e.currentTarget as Element).setPointerCapture(e.pointerId);
      } catch {
        /* capture facultative */
      }
      const trail: Pt[] = [];
      gs.trails.push(trail);
      if (s === 'clipper') gs.clip.push(trail);
      if (s === 'beard') gs.beard.push(trail);
      gs.pointers.set(e.pointerId, gs.trails.length - 1);
      addPoint(e.pointerId, p, t);
    }
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (!gs.pointers.has(e.pointerId)) return;
    const p = toSvg(e);
    if (p) addPoint(e.pointerId, p, P.current.clock());
  };
  const onUp = (e: RPointerEvent<SVGSVGElement>) => {
    gs.pointers.delete(e.pointerId);
  };

  const pickTool = (tool: Tool) => {
    const t = P.current.clock();
    const r = engine.selectTool(t, tool);
    if (r === 'ignored') return;
    toolFlash.current = { tool, at: t, ok: r !== 'wrong' };
    if (r === 'ok') sfx('tap', P.current.sound);
  };

  // --- État visuel du client
  const steps = spec.steps;
  const doneCount = phase === 'done' || phase === 'closed' ? steps.length : engine.stepIndex;
  const has = (t: Tool) => steps.includes(t);
  const done = (t: Tool) => has(t) && steps.indexOf(t) < doneCount;
  const untidy = has('scissors') && !done('scissors') ? (step === 'scissors' ? 1 - engine.progress : 1) : 0;
  const strands = has('scissors') && !done('scissors') ? spec.snips.slice(step === 'scissors' ? engine.snipIndex : 0) : [];
  const cutKey = [
    done('clipper') || !has('clipper') ? 1 : 0,
    untidy.toFixed(2),
    strands.join('.'),
    done('beard') || !has('beard') ? 1 : 0,
    done('razor') ? 1 : 0,
    done('product') ? 1 : 0,
    phase === 'done' ? 1 : 0,
  ].join('|');
  const cut: CutState = useMemo(
    () => ({
      bushySides: has('clipper') && !done('clipper'),
      fadedSides: true,
      untidy,
      strands: strands.map((i) => SNIP_POINTS[i]),
      wildBeard: has('beard') && !done('beard'),
      sharpLine: done('razor') && spec.contour === 'hairline',
      shine: done('product'),
      sparkle: phase === 'done',
    }),
    [cutKey, engine.index],
  );
  const target: CutState = useMemo(
    () => ({ ...NEAT, sharpLine: has('razor') && spec.contour === 'hairline', shine: has('product') }),
    [engine.index],
  );
  const patience = engine.patience(now);
  const mood = phase === 'done' ? 1 : phase === 'leaving' ? 0 : patience > 0.55 ? 0.8 : patience > 0.28 ? 0.45 : 0.1;

  // Entrée, sortie ravie ou départ fâché du client.
  const since = now - engine.phaseAt;
  let dx = 0;
  let tilt = 0;
  if (phase === 'arrive') dx = (1 - ease(since / ARRIVE_MS)) * 760;
  else if (phase === 'done') dx = -ease((since - (DONE_MS - 380)) / 380) * 800;
  else if (phase === 'leaving') {
    if (since < 450) dx = Math.sin(since / 28) * 12;
    else dx = ease((since - 450) / (LEAVE_MS - 450)) * 800;
    tilt = phase === 'leaving' && since > 450 ? 4 : 0;
  } else if (phase === 'closed') dx = 3000;
  const started = now >= props.startAt;
  const toolOn = step !== null && engine.tool === step;

  // --- Rendu
  return (
    <div className="relative h-full w-full overflow-hidden select-none touch-none" style={{ fontFamily: 'Arial, Helvetica, sans-serif' }}>
      <style>{CSS}</style>
      {/* Voile et lumière de salon pour la lisibilité */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 38% 55% at 50% 42%, rgba(57,245,166,0.10), rgba(0,0,0,0) 70%), linear-gradient(180deg, rgba(5,10,8,0.35), rgba(5,10,8,0.55))',
        }}
      />

      {/* Client : calque du dessin (déplacé par le compositeur) et calque des repères qui reçoit les gestes */}
      <div className="pointer-events-none absolute" style={{ left: '22%', right: '22%', top: 0, bottom: 140 }}>
        <svg viewBox="30 10 340 440" className="h-full w-full" preserveAspectRatio="xMidYMin meet" style={{ overflow: 'visible' }}>
          <defs>
            <radialGradient id="br-spot" cx="0.5" cy="0.45" r="0.5">
              <stop offset="0" stopColor="#39f5a6" stopOpacity={0.22} />
              <stop offset="1" stopColor="#39f5a6" stopOpacity={0} />
            </radialGradient>
          </defs>
          <ellipse cx={200} cy={220} rx={190} ry={210} fill="url(#br-spot)" />
        </svg>
      </div>
      <div
        className="pointer-events-none absolute"
        style={{ left: '22%', right: '22%', top: 0, bottom: 140, transform: `translateX(${dx}px) rotate(${tilt}deg)`, willChange: 'transform' }}
      >
        <svg viewBox="30 10 340 440" className="h-full w-full" preserveAspectRatio="xMidYMin meet" style={{ overflow: 'visible' }}>
          <ClientFace look={spec.look} cut={cut} mood={mood} uid={`c${engine.index}`} clipTrails={gs.clip} beardTrails={gs.beard} ver={gs.ver} />
        </svg>
      </div>
      <div className="absolute" style={{ left: '22%', right: '22%', top: 0, bottom: 140 }}>
        <svg
          ref={svgRef}
          viewBox="30 10 340 440"
          className="h-full w-full"
          preserveAspectRatio="xMidYMin meet"
          style={{ touchAction: 'none', overflow: 'visible' }}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {phase === 'work' && toolOn && <Guides engine={engine} gs={gs} />}
          {/* Traits en cours (contour) */}
          {phase === 'work' &&
            step === 'razor' &&
            gs.trails.map((tr, i) =>
              tr.length > 1 ? <path key={i} d={polyPath(tr)} stroke="#ffffff" strokeWidth={3} fill="none" strokeLinecap="round" opacity={0.9} /> : null,
            )}
        </svg>
      </div>

      {/* Ticket de commande */}
      <Ticket engine={engine} T={T} now={now} target={target} patience={patience} />

      {/* Panneau droit : série, multiplicateur, compteurs */}
      <SidePanel engine={engine} T={T} />

      {/* Consigne et progression de l'étape */}
      {started && phase === 'work' && step && (
        <div className="pointer-events-none absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: 150, width: 560 }}>
          <div
            className="rounded-full px-6 py-2 text-center text-[22px] font-black tracking-wide"
            style={{
              background: 'rgba(8,14,12,0.82)',
              color: toolOn ? '#F4EBD9' : GOLD,
              border: `2px solid ${toolOn ? NEON : GOLD}`,
              boxShadow: `0 0 18px ${toolOn ? 'rgba(57,245,166,0.45)' : 'rgba(212,168,75,0.4)'}`,
            }}
          >
            {toolOn ? T.howTo[step] : T.pick}
          </div>
          {toolOn && (step === 'clipper' || step === 'beard' || step === 'razor' || step === 'scissors') && (
            <div className="mt-2 h-3 w-[380px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (engine.progress / (step === 'scissors' ? 1 : 0.9)) * 100)}%`,
                  background: 'linear-gradient(90deg,#1fbf7a,#39f5a6)',
                  boxShadow: '0 0 12px #39f5a6',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Choix du produit */}
      {phase === 'work' && step === 'product' && toolOn && (
        <div className="absolute left-1/2 flex -translate-x-1/2 gap-5" style={{ bottom: 214 }}>
          {spec.products.map((k) => (
            <ProductButton key={k} kind={k} label={T.products[k]} onPick={() => engine.chooseProduct(P.current.clock(), k)} />
          ))}
        </div>
      )}

      {/* Finition : appui long */}
      {phase === 'work' && step === 'finish' && toolOn && <HoldButton engine={engine} label={T.hold} now={now} clock={() => P.current.clock()} />}

      {/* Barre d'outils */}
      <div className="absolute left-1/2 flex -translate-x-1/2 gap-3" style={{ bottom: 18 }}>
        {TOOLS.map((tool) => {
          const f = toolFlash.current;
          const flashing = f && f.tool === tool && now - f.at < 450;
          const active = engine.tool === tool;
          const bad = flashing && !f.ok;
          return (
            <button
              key={tool}
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                pickTool(tool);
              }}
              className={`relative flex flex-col items-center justify-center rounded-2xl ${bad ? 'br-shake' : ''}`}
              style={{
                width: 118,
                height: 108,
                background: active
                  ? 'linear-gradient(180deg, rgba(57,245,166,0.35), rgba(10,34,25,0.92))'
                  : bad
                    ? 'linear-gradient(180deg, rgba(255,77,109,0.45), rgba(40,8,14,0.92))'
                    : 'linear-gradient(180deg, rgba(40,46,44,0.92), rgba(10,14,13,0.95))',
                border: `2px solid ${active ? NEON : bad ? RED : 'rgba(244,235,217,0.28)'}`,
                boxShadow: active
                  ? '0 0 22px rgba(57,245,166,0.65), inset 0 0 14px rgba(57,245,166,0.25)'
                  : bad
                    ? '0 0 22px rgba(255,77,109,0.6)'
                    : '0 6px 18px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.12)',
                touchAction: 'none',
              }}
            >
              <ToolIcon tool={tool} size={50} color={active ? '#bfffe2' : '#F4EBD9'} />
              <span className="mt-1 text-[15px] font-bold uppercase tracking-wide" style={{ color: active ? '#bfffe2' : '#F4EBD9' }}>
                {T.tools[tool]}
              </span>
            </button>
          );
        })}
      </div>

      {phase === 'closed' && (
        <div className="pointer-events-none absolute inset-x-0 text-center text-6xl font-black italic" style={{ top: '35%', color: GOLD, textShadow: `0 0 24px ${GOLD}` }}>
          {T.closed}
        </div>
      )}

      {/* Messages */}
      <div className="pointer-events-none absolute inset-x-0" style={{ top: '30%' }}>
        {popups.current
          .filter((p) => now >= p.at)
          .map((p) => (
            <div key={p.id} className="br-pop absolute inset-x-0 flex flex-col items-center" style={{ top: p.y ?? (p.size === 'sm' ? 120 : p.size === 'md' ? 60 : 0) }}>
              <div
                className="font-black italic tracking-wide"
                style={{
                  fontSize: p.size === 'xl' ? 76 : p.size === 'md' ? 46 : 30,
                  color: p.color,
                  textShadow: `0 0 18px ${p.color}, 0 4px 0 rgba(0,0,0,0.6)`,
                  WebkitTextStroke: p.size === 'xl' ? '2px rgba(0,0,0,0.35)' : undefined,
                }}
              >
                {p.big}
              </div>
              {p.small && (
                <div className="font-black" style={{ fontSize: p.size === 'xl' ? 44 : 26, color: '#F4EBD9', textShadow: '0 2px 10px rgba(0,0,0,0.8)' }}>
                  {p.small}
                </div>
              )}
              {p.detail && (
                <div className="mt-1 rounded-full px-4 py-1 text-[18px] font-bold" style={{ background: 'rgba(0,0,0,0.6)', color: '#F4EBD9' }}>
                  {p.detail}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}

/** Repères de geste : zones de tondeuse et de barbe, ligne de contour, cibles des ciseaux. */
function Guides({ engine, gs }: { engine: BarberEngine; gs: Gesture }) {
  const step = engine.step;
  const spec = engine.spec;
  if (step === 'clipper') {
    return (
      <g pointerEvents="none">
        {CLIP_ZONES.map((z, i) => (
          <g key={i} className="br-pulse">
            <ellipse cx={z.cx} cy={z.cy} rx={z.rx + 4} ry={z.ry + 4} fill="none" stroke={NEON} strokeOpacity={0.25} strokeWidth={8} />
            <ellipse cx={z.cx} cy={z.cy} rx={z.rx + 4} ry={z.ry + 4} fill="rgba(57,245,166,0.10)" stroke={NEON} strokeWidth={2.5} strokeDasharray="6 5" />
          </g>
        ))}
        {CLIP_CELLS.map((c, i) => (gs.covered.has(i) ? null : <circle key={i} cx={c.x} cy={c.y} r={1.6} fill="#bfffe2" opacity={0.7} />))}
      </g>
    );
  }
  if (step === 'beard') {
    return (
      <g pointerEvents="none">
        <g className="br-pulse">
          <path d={BEARD_WILD} fill="none" stroke={NEON} strokeOpacity={0.25} strokeWidth={8} />
          <path d={BEARD_WILD} fill="rgba(57,245,166,0.08)" stroke={NEON} strokeWidth={2.5} strokeDasharray="7 6" />
        </g>
        {BEARD_CELLS.map((c, i) => (gs.covered.has(i) ? null : <circle key={i} cx={c.x} cy={c.y} r={2} fill="#bfffe2" opacity={0.75} />))}
      </g>
    );
  }
  if (step === 'razor') {
    const segs = CONTOUR_SEGMENTS[spec.contour];
    const pts = CONTOUR_POINTS[spec.contour];
    return (
      <g pointerEvents="none">
        {segs.map((s, i) => (
          <path key={i} d={polyPath(s)} stroke={NEON} strokeOpacity={0.16} strokeWidth={spec.contourTol * 2} fill="none" strokeLinecap="round" />
        ))}
        {pts.map((c, i) => (
          <circle key={i} cx={c.x} cy={c.y} r={gs.covered.has(i) ? 3.2 : 2.4} fill={gs.covered.has(i) ? NEON : '#ffffff'} opacity={gs.covered.has(i) ? 1 : 0.8} />
        ))}
      </g>
    );
  }
  if (step === 'scissors') {
    return (
      <g pointerEvents="none">
        {spec.snips.map((a, i) => {
          if (i < engine.snipIndex) return null;
          const p = SNIP_POINTS[a];
          const next = i === engine.snipIndex;
          return (
            <g key={a} transform={`translate(${p.x} ${p.y})`}>
              {next && <circle className="br-ring" r={SNIP_RADIUS} fill="none" stroke={GOLD} strokeWidth={3} />}
              {next && <circle r={24} fill={GOLD} opacity={0.3} />}
              <circle r={next ? 19 : 15} fill={next ? GOLD : 'rgba(10,14,13,0.8)'} stroke={next ? '#fff3cf' : GOLD} strokeWidth={2.5} />
              <text y={next ? 7 : 6} textAnchor="middle" fontSize={next ? 20 : 16} fontWeight={900} fill={next ? '#1a1206' : GOLD} fontFamily="Arial">
                {i + 1}
              </text>
            </g>
          );
        })}
      </g>
    );
  }
  return null;
}

function Ticket({ engine, T, now, target, patience }: { engine: BarberEngine; T: (typeof TXT)['fr']; now: number; target: CutState; patience: number }) {
  const spec = engine.spec;
  const phase = engine.phase;
  const doneCount = phase === 'done' ? spec.steps.length : engine.stepIndex;
  const pc = patience > 0.55 ? NEON : patience > 0.28 ? '#ffd166' : RED;
  const enter = phase === 'arrive' ? ease((now - engine.phaseAt) / 500) : 1;
  return (
    <div
      className="absolute flex flex-col rounded-2xl p-4"
      style={{
        left: 22,
        top: 22,
        width: 262,
        background: 'linear-gradient(180deg,#F8F2E6,#E8D9BC)',
        boxShadow: '0 14px 34px rgba(0,0,0,0.55), 0 0 0 3px rgba(212,168,75,0.6)',
        transform: `translateX(${(1 - enter) * -320}px)`,
        opacity: phase === 'closed' ? 0.4 : 1,
        color: '#0E2F23',
      }}
    >
      <div className="flex items-center justify-between">
        <span className="whitespace-nowrap text-[14px] font-black tracking-wide">{T.order}</span>
        <span className="rounded-full px-2 py-0.5 text-[13px] font-black" style={{ background: '#0E2F23', color: GOLD }}>
          #{spec.index + 1}
        </span>
      </div>
      <div className="mt-2 flex justify-center overflow-hidden rounded-xl" style={{ background: 'radial-gradient(circle at 50% 40%, #2a3a33, #0d1512)', height: 128 }}>
        <svg viewBox="62 24 276 400" height={128} width={110}>
          <ClientFace look={spec.look} cut={target} mood={0.8} uid={`t${spec.index}`} />
        </svg>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {spec.steps.map((s, i) => {
          const ok = i < doneCount;
          const cur = i === doneCount && phase === 'work';
          return (
            <div
              key={s}
              className={`flex items-center gap-3 rounded-xl px-2 py-1.5 ${cur ? 'br-glow' : ''}`}
              style={{
                background: cur ? '#0E2F23' : ok ? 'rgba(14,47,35,0.10)' : 'rgba(14,47,35,0.05)',
                border: cur ? `2px solid ${GOLD}` : '2px solid transparent',
              }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: ok ? '#1D5A43' : cur ? GOLD : '#0E2F23' }}
              >
                {ok ? (
                  <svg width={24} height={24} viewBox="0 0 24 24">
                    <path d="M5 12.5 L10 17 L19 7" stroke="#F4EBD9" strokeWidth={3.2} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <ToolIcon tool={s} size={28} color={cur ? '#0E2F23' : '#F4EBD9'} />
                )}
              </div>
              <span className="flex-1 text-[18px] font-bold" style={{ color: cur ? '#F4EBD9' : '#0E2F23', textDecoration: ok ? 'line-through' : undefined, opacity: ok ? 0.6 : 1 }}>
                {T.tools[s]}
              </span>
              {s === 'product' && (
                <span className="flex items-center gap-1 rounded-lg px-1" style={{ background: 'rgba(255,255,255,0.75)' }}>
                  <ProductIcon kind={spec.product} size={30} />
                  <span className="text-[13px] font-black" style={{ color: '#0E2F23' }}>
                    {T.products[spec.product]}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between text-[13px] font-black tracking-wider">
          <span>{T.patience}</span>
          <PatienceFace v={patience} color={pc} />
        </div>
        <div className="h-4 w-full overflow-hidden rounded-full" style={{ background: 'rgba(14,47,35,0.18)' }}>
          <div
            className={`h-full rounded-full ${patience < 0.28 && phase === 'work' ? 'br-blink' : ''}`}
            style={{ width: `${patience * 100}%`, background: `linear-gradient(90deg, ${pc}, ${pc}cc)`, boxShadow: `0 0 10px ${pc}` }}
          />
        </div>
      </div>
    </div>
  );
}

function PatienceFace({ v, color }: { v: number; color: string }) {
  const mouth = v > 0.55 ? 'M7 14 Q12 18 17 14' : v > 0.28 ? 'M7 15 L17 15' : 'M7 17 Q12 12 17 17';
  return (
    <svg width={22} height={22} viewBox="0 0 24 24">
      <circle cx={12} cy={12} r={10.5} fill={color} stroke="#0E2F23" strokeWidth={1.5} />
      <circle cx={8.5} cy={9.5} r={1.4} fill="#0E2F23" />
      <circle cx={15.5} cy={9.5} r={1.4} fill="#0E2F23" />
      <path d={mouth} stroke="#0E2F23" strokeWidth={1.8} fill="none" strokeLinecap="round" />
    </svg>
  );
}

function SidePanel({ engine, T }: { engine: BarberEngine; T: (typeof TXT)['fr'] }) {
  const mult = engine.multiplier;
  const streakDots = Math.min(3, engine.streak);
  return (
    <div className="pointer-events-none absolute flex flex-col items-end gap-3" style={{ right: 22, top: 22, width: 200 }}>
      <div
        className={`flex h-[88px] w-[132px] items-center justify-center rounded-2xl text-[54px] font-black italic ${mult > 1 ? 'br-glow' : ''}`}
        style={{
          background: mult > 1 ? 'linear-gradient(180deg,#2b2208,#120e04)' : 'rgba(8,14,12,0.75)',
          color: mult > 1 ? GOLD : 'rgba(244,235,217,0.35)',
          border: `3px solid ${mult > 1 ? GOLD : 'rgba(244,235,217,0.2)'}`,
          boxShadow: mult > 1 ? `0 0 26px rgba(212,168,75,0.7)` : undefined,
          textShadow: mult > 1 ? `0 0 14px ${GOLD}` : undefined,
        }}
      >
        x{mult}
      </div>
      <div className="flex w-[200px] flex-col gap-2 rounded-2xl p-3" style={{ background: 'rgba(8,14,12,0.78)', border: '1px solid rgba(57,245,166,0.35)' }}>
        <div className="flex items-center justify-between">
          <span className="text-[14px] font-black tracking-wider" style={{ color: '#F4EBD9' }}>
            {T.streak}
          </span>
          <div className="flex gap-1.5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-4 w-4 rounded-full"
                style={{
                  background: i < streakDots ? (mult > 1 ? GOLD : NEON) : 'rgba(244,235,217,0.15)',
                  boxShadow: i < streakDots ? `0 0 8px ${mult > 1 ? GOLD : NEON}` : undefined,
                }}
              />
            ))}
          </div>
        </div>
        <Stat label={T.served} value={engine.stats.served} color={NEON} />
        <Stat label={T.perfects} value={engine.stats.perfect} color={GOLD} />
      </div>
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[14px] font-black tracking-wider" style={{ color: '#F4EBD9' }}>
        {label}
      </span>
      <span className="text-[26px] font-black" style={{ color, textShadow: `0 0 10px ${color}` }}>
        {value}
      </span>
    </div>
  );
}

function ProductButton({ kind, label, onPick }: { kind: ProductKind; label: string; onPick: () => void }) {
  const c = PRODUCT_COLORS[kind];
  return (
    <button
      type="button"
      onPointerDown={(e) => {
        e.preventDefault();
        onPick();
      }}
      className="br-pop flex flex-col items-center justify-center rounded-2xl"
      style={{
        width: 132,
        height: 150,
        background: 'linear-gradient(180deg, rgba(30,36,34,0.95), rgba(8,12,11,0.95))',
        border: `3px solid ${c.main}`,
        boxShadow: `0 0 20px ${c.main}88`,
        touchAction: 'none',
      }}
    >
      <ProductIcon kind={kind} size={84} />
      <span className="mt-1 text-[19px] font-black uppercase" style={{ color: '#F4EBD9' }}>
        {label}
      </span>
    </button>
  );
}

function HoldButton({ engine, label, now, clock }: { engine: BarberEngine; label: string; now: number; clock: () => number }) {
  const prog = engine.holdProgress(now);
  const R = 70;
  const C = 2 * Math.PI * R;
  return (
    <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: 200 }}>
    <button
      type="button"
      className="br-pop relative flex items-center justify-center rounded-full"
      style={{
        width: 176,
        height: 176,
        background: 'radial-gradient(circle at 50% 40%, rgba(57,245,166,0.35), rgba(8,14,12,0.95) 70%)',
        boxShadow: `0 0 ${20 + prog * 30}px rgba(57,245,166,${0.5 + prog * 0.5})`,
        touchAction: 'none',
      }}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* capture facultative */
        }
        engine.holdStart(clock());
      }}
      onPointerUp={() => engine.holdEnd(clock())}
      onPointerCancel={() => engine.holdEnd(clock())}
    >
      <svg width={176} height={176} viewBox="0 0 176 176" className="absolute inset-0">
        <circle cx={88} cy={88} r={R} fill="none" stroke="rgba(244,235,217,0.18)" strokeWidth={10} />
        <circle
          cx={88}
          cy={88}
          r={R}
          fill="none"
          stroke={NEON}
          strokeWidth={10}
          strokeLinecap="round"
          strokeDasharray={`${C * prog} ${C}`}
          transform="rotate(-90 88 88)"
        />
      </svg>
      <div className="relative flex flex-col items-center">
        <ToolIcon tool="finish" size={64} color="#bfffe2" />
        <span className="text-[18px] font-black tracking-wider" style={{ color: '#F4EBD9' }}>
          {label}
        </span>
      </div>
    </button>
    </div>
  );
}

const CSS = `
@keyframes br-pop-k { 0% { transform: scale(0.5); opacity: 0 } 18% { transform: scale(1.12); opacity: 1 } 30% { transform: scale(1) } 80% { opacity: 1 } 100% { transform: translateY(-30px); opacity: 0 } }
.br-pop { animation: br-pop-k 1.4s ease-out forwards; }
button.br-pop { animation: br-in-k 0.25s ease-out; }
@keyframes br-in-k { 0% { transform: scale(0.7); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
@keyframes br-shake-k { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-8px) } 40% { transform: translateX(8px) } 60% { transform: translateX(-6px) } 80% { transform: translateX(5px) } }
.br-shake { animation: br-shake-k 0.4s ease-in-out; }
@keyframes br-glow-k { 0%,100% { box-shadow: 0 0 8px rgba(212,168,75,0.5) } 50% { box-shadow: 0 0 22px rgba(212,168,75,0.95) } }
.br-glow { animation: br-glow-k 1.1s ease-in-out infinite; }
@keyframes br-pulse-k { 0%,100% { opacity: 1 } 50% { opacity: 0.55 } }
.br-pulse { animation: br-pulse-k 0.9s ease-in-out infinite; }
@keyframes br-ring-k { 0% { transform: scale(0.8); opacity: 1 } 100% { transform: scale(1.35); opacity: 0 } }
.br-ring { transform-box: fill-box; transform-origin: center; animation: br-ring-k 0.9s ease-out infinite; }
@keyframes br-blink-k { 0%,100% { opacity: 1 } 50% { opacity: 0.45 } }
.br-blink { animation: br-blink-k 0.5s linear infinite; }
`;
