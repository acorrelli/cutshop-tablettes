// Perfect Pour : maintenir pour verser, relâcher au bon moment. La mousse retombe après le service :
// le bon barman relâche juste au-dessus de la zone parfaite.
import { Star } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../audio';
import type { GameProps } from '../types';
import { GLASS_KINDS, PourEngine, type GlassKind, type Grade } from './engine';

const TXT = {
  fr: {
    glassType: 'Type de verre',
    kinds: { tulip: 'Tulipe', straight: 'Droit', ballon: 'Ballon', tasting: 'Dégustation' } as Record<GlassKind, string>,
    tooMuch: 'Trop de mousse',
    perfectZone: 'Zone parfaite',
    notEnough: 'Pas assez',
    hold: 'Maintiens pour verser',
    pouring: 'Ça coule...',
    hint: 'La mousse retombe : relâche juste au-dessus de la zone.',
    glass: 'Verre',
    streak: 'Série',
    grades: { perfect: 'PARFAIT !', great: 'TRÈS BIEN !', ok: 'PAS MAL', miss: 'RATÉ', overflow: 'ÇA DÉBORDE !' } as Record<Grade, string>,
  },
  en: {
    glassType: 'Glass type',
    kinds: { tulip: 'Tulip', straight: 'Straight', ballon: 'Goblet', tasting: 'Tasting' } as Record<GlassKind, string>,
    tooMuch: 'Too much foam',
    perfectZone: 'Perfect zone',
    notEnough: 'Not enough',
    hold: 'Hold to pour',
    pouring: 'Pouring...',
    hint: 'The foam settles: release just above the zone.',
    glass: 'Glass',
    streak: 'Streak',
    grades: { perfect: 'PERFECT!', great: 'GREAT!', ok: 'NOT BAD', miss: 'MISSED', overflow: 'OVERFLOW!' } as Record<Grade, string>,
  },
};

const GRADE_COLOR: Record<Grade, string> = {
  perfect: '#F6C445',
  great: '#7CE3A0',
  ok: '#F4EBD9',
  miss: '#FF7A6B',
  overflow: '#FF7A6B',
};

// ---------------------------------------------------------------------------
// Géométrie des verres (repère 400 x 520). Le niveau 0 est le fond intérieur, 1 le bord.

interface GlassShape {
  /** Contour intérieur (zone remplie par la bière). */
  inner: string;
  /** Contour extérieur du verre (paroi, pied). */
  outer: string;
  rim: number;
  bottom: number;
  /** Largeur intérieure au bord, pour la mousse qui déborde. */
  rimX: [number, number];
}

const SHAPES: Record<GlassKind, GlassShape> = {
  tulip: {
    inner: 'M138 112 C140 136 150 150 150 166 C150 186 126 214 126 262 C126 312 160 346 200 346 C240 346 274 312 274 262 C274 214 250 186 250 166 C250 150 260 136 262 112 Z',
    outer:
      'M128 104 L272 104 C270 134 260 150 260 166 C260 184 286 212 286 262 C286 318 250 356 212 360 L208 442 C246 446 268 454 268 462 C268 472 132 472 132 462 C132 454 154 446 192 442 L188 360 C150 356 114 318 114 262 C114 212 140 184 140 166 C140 150 130 134 128 104 Z',
    rim: 112,
    bottom: 346,
    rimX: [138, 262],
  },
  straight: {
    inner: 'M136 92 L264 92 L250 418 C250 424 246 428 240 428 L160 428 C154 428 150 424 150 418 Z',
    outer: 'M124 84 L276 84 L262 440 C261 452 254 458 244 458 L156 458 C146 458 139 452 138 440 Z',
    rim: 92,
    bottom: 428,
    rimX: [136, 264],
  },
  ballon: {
    inner: 'M152 132 C130 160 104 202 104 252 C104 314 148 352 200 352 C252 352 296 314 296 252 C296 202 270 160 248 132 Z',
    outer:
      'M142 124 L258 124 C282 154 308 198 308 252 C308 318 262 362 210 366 L207 442 C244 446 266 454 266 462 C266 472 134 472 134 462 C134 454 156 446 193 442 L190 366 C138 362 92 318 92 252 C92 198 118 154 142 124 Z',
    rim: 132,
    bottom: 352,
    rimX: [152, 248],
  },
  tasting: {
    inner: 'M150 178 L250 178 C250 236 246 300 222 326 C214 334 186 334 178 326 C154 300 150 236 150 178 Z',
    outer:
      'M140 170 L260 170 C260 240 256 308 228 336 C222 342 214 344 208 345 L206 442 C240 446 262 454 262 462 C262 472 138 472 138 462 C138 454 160 446 194 442 L192 345 C186 344 178 342 172 336 C144 308 140 240 140 170 Z',
    rim: 178,
    bottom: 330,
    rimX: [150, 250],
  },
};

/** Position dans la jauge : seule la partie haute du verre (40 % à 100 %) est affichée, pour plus de précision. */
const g = (level: number) => Math.min(100, Math.max(0, ((level - 0.4) / 0.6) * 100));

const levelY = (s: GlassShape, level: number) => s.bottom - (s.bottom - s.rim) * Math.min(1.04, Math.max(0, level));

/** Petites bulles qui remontent dans la bière (positions calculées, pas de hasard). */
const BUBBLES = Array.from({ length: 16 }, (_, i) => ({
  x: 0.15 + ((i * 37) % 70) / 100,
  speed: 40 + ((i * 53) % 50),
  offset: (i * 97) % 300,
  r: 1.6 + ((i * 7) % 3) * 0.7,
}));

function GlassIcon({ kind, size = 34 }: { kind: GlassKind; size?: number }) {
  const s = SHAPES[kind];
  return (
    <svg viewBox="90 70 220 410" width={size} height={size * 1.4} aria-hidden>
      <path d={s.outer} fill="rgba(255,255,255,0.12)" stroke="rgba(255,255,255,0.75)" strokeWidth={10} />
      <path d={s.inner} fill="#E9A923" opacity={0.85} />
    </svg>
  );
}

export default function PerfectPour(props: GameProps) {
  const { seed, clock, startAt, durationMs, sound, lang, onLive, onEnd } = props;
  const txt = TXT[lang];
  const engineRef = useRef<PourEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new PourEngine(seed, durationMs);
    engineRef.current.start(startAt);
  }
  const engine = engineRef.current;
  const [, setFrame] = useState(0);
  const ended = useRef(false);
  const lastScore = useRef(0);
  const lastGraded = useRef(0);
  const pointers = useRef(new Set<number>());
  const cb = useRef({ onLive, onEnd, sound, clock });
  cb.current = { onLive, onEnd, sound, clock };

  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const now = cb.current.clock();
      engine.update(now);
      const served = engine.served();
      if (served !== lastGraded.current) {
        lastGraded.current = served;
        const g = engine.last?.grade;
        if (g) sfx(g === 'perfect' ? 'perfect' : g === 'miss' || g === 'overflow' ? 'bad' : 'good', cb.current.sound);
      }
      if (engine.score !== lastScore.current) {
        lastScore.current = engine.score;
        cb.current.onLive(engine.score);
      }
      if (!ended.current && engine.isOver(now)) {
        ended.current = true;
        engine.finish(now);
        cb.current.onEnd(engine.result());
        setFrame((f) => f + 1);
        return;
      }
      setFrame((f) => (f + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
    };
  }, [engine]);

  // Clavier (espace) pour les tests sur ordinateur.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        e.preventDefault();
        press();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Space') release();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  });

  function press() {
    const before = engine.phase;
    engine.press(cb.current.clock());
    if (before !== 'pouring' && engine.phase === 'pouring') sfx('pour', cb.current.sound);
  }
  function release() {
    engine.release(cb.current.clock());
  }
  const onDown = (e: ReactPointerEvent) => {
    pointers.current.add(e.pointerId);
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    press();
  };
  const onUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size === 0) release();
  };

  const now = clock();
  const shape = SHAPES[engine.spec.kind];
  const spec = engine.spec;
  const pouring = engine.phase === 'pouring';
  const graded = engine.phase === 'graded' && engine.last;
  const overflow = graded && engine.last?.grade === 'overflow';
  const total = Math.min(1, engine.total);
  const liquidTop = levelY(shape, engine.liquid);
  const foamTop = levelY(shape, total);
  const zoneTop = levelY(shape, spec.target + spec.tol);
  const zoneBottom = levelY(shape, spec.target - spec.tol);
  const t = now / 1000;
  const wave = (k: number) => Math.sin(t * 5 + k) * 2.2;
  const [rx0, rx1] = shape.rimX;

  // Mousse : bord supérieur bombé en petites vagues.
  const foamPath = (() => {
    const left = 90;
    const right = 310;
    const n = 9;
    const base = liquidTop + 6;
    let d = `M${left} ${base} L${left} ${foamTop}`;
    for (let i = 0; i < n; i++) {
      const x0 = left + ((right - left) * i) / n;
      const x1 = left + ((right - left) * (i + 1)) / n;
      d += ` Q${(x0 + x1) / 2} ${foamTop - 9 + wave(i)} ${x1} ${foamTop}`;
    }
    return `${d} L${right} ${base} Z`;
  })();

  const gaugeLevel = Math.min(1, engine.total);
  const glassNo = engine.index + 1;
  const popup = graded ? engine.last : null;
  const popupAge = graded ? now - engine.phaseAt : 0;

  return (
    <div className="relative h-full w-full select-none overflow-hidden touch-none" data-testid="pour-game">
      <div className="grid h-full grid-cols-[minmax(180px,220px)_1fr_minmax(190px,240px)] gap-4 p-4">
        {/* Type de verre */}
        <aside className="flex flex-col justify-center">
          <div className="rounded-3xl bg-black/55 p-3 ring-1 ring-white/15 backdrop-blur">
            <p className="mb-2 px-2 text-sm font-black uppercase tracking-[0.18em] text-cream/80">{txt.glassType}</p>
            <ul className="space-y-1.5">
              {GLASS_KINDS.map((k) => {
                const active = k === spec.kind;
                return (
                  <li
                    key={k}
                    data-testid={`pour-kind-${k}`}
                    data-active={active || undefined}
                    className={`flex items-center gap-3 rounded-2xl px-2 py-1.5 transition ${active ? 'bg-[#7CE3A0]/15 ring-2 ring-[#7CE3A0] shadow-[0_0_24px_rgba(124,227,160,0.35)]' : 'opacity-60'}`}
                  >
                    <span className="grid w-9 shrink-0 place-items-center">
                      <GlassIcon kind={k} size={k === 'tasting' ? 36 : 28} />
                    </span>
                    <span className="text-base font-black uppercase tracking-wide text-cream">{txt.kinds[k]}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <p className="mt-3 px-1 text-center text-sm font-bold text-cream/70">
            {txt.glass} {glassNo}
            {engine.streak >= 2 && (
              <span className="ml-2 rounded-full bg-gold px-2 py-0.5 text-xs font-black text-bottle-950">
                {txt.streak} x{engine.streak}
              </span>
            )}
          </p>
        </aside>

        {/* Verre et tireuse : toute la zone sert de bouton */}
        <div
          className="relative min-h-0 cursor-pointer"
          onPointerDown={onDown}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          onLostPointerCapture={onUp}
          data-testid="pour-area"
        >
          <svg viewBox="40 -84 320 574" className="mx-auto h-full max-w-full" preserveAspectRatio="xMidYMid meet">
            <defs>
              <linearGradient id="pp-beer" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFD766" />
                <stop offset="0.45" stopColor="#F2B233" />
                <stop offset="1" stopColor="#C97A12" />
              </linearGradient>
              <linearGradient id="pp-foam" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#FFFDF6" />
                <stop offset="1" stopColor="#F1E2BF" />
              </linearGradient>
              <linearGradient id="pp-glass" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.28" />
                <stop offset="0.18" stopColor="#FFFFFF" stopOpacity="0.06" />
                <stop offset="0.8" stopColor="#FFFFFF" stopOpacity="0.04" />
                <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.22" />
              </linearGradient>
              <linearGradient id="pp-chrome" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#5C6166" />
                <stop offset="0.35" stopColor="#E9EDF0" />
                <stop offset="0.6" stopColor="#A9B0B6" />
                <stop offset="1" stopColor="#4A4F54" />
              </linearGradient>
              <linearGradient id="pp-stream" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0" stopColor="#E9A923" stopOpacity="0.75" />
                <stop offset="0.5" stopColor="#FFE08A" />
                <stop offset="1" stopColor="#E9A923" stopOpacity="0.75" />
              </linearGradient>
              <clipPath id={`pp-inner-${spec.kind}`}>
                <path d={shape.inner} />
              </clipPath>
              <filter id="pp-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="6" />
              </filter>
            </defs>

            {/* Tireuse */}
            <g>
              <rect x="150" y="-10" width="100" height="26" rx="8" fill="url(#pp-chrome)" />
              <rect x="186" y="14" width="28" height="34" rx="6" fill="url(#pp-chrome)" />
              <path d="M182 46 L218 46 L212 64 L188 64 Z" fill="url(#pp-chrome)" />
              <rect x="194" y="62" width="12" height="12" rx="3" fill="#3B3F43" />
              <g transform={`rotate(${pouring ? -24 : 0} 200 6)`} style={{ transition: 'transform 120ms ease-out' }}>
                <rect x="190" y="-74" width="20" height="80" rx="9" fill="#0E2F23" stroke="#D4A84B" strokeWidth="3" />
                <text x="200" y="-30" fontSize="11" fontWeight="900" fill="#D4A84B" textAnchor="middle" transform="rotate(-90 200 -30)">
                  CUTSHOP
                </text>
              </g>
            </g>

            {/* Jet */}
            {pouring && (
              <g>
                <rect
                  x={200 - 4.5 - Math.sin(t * 30) * 0.8}
                  y="72"
                  width={9 + Math.sin(t * 30) * 1.6}
                  height={Math.max(0, foamTop - 66)}
                  rx="4"
                  fill="url(#pp-stream)"
                />
                <rect x="198" y="72" width="2" height={Math.max(0, foamTop - 70)} fill="#FFF6D6" opacity="0.8" />
              </g>
            )}

            {/* Halo sous le verre */}
            <ellipse cx="200" cy="470" rx="110" ry="10" fill="#000" opacity="0.45" />

            {/* Contenu du verre */}
            <g clipPath={`url(#pp-inner-${spec.kind})`}>
              <rect x="80" y={liquidTop} width="240" height={shape.bottom - liquidTop + 10} fill="url(#pp-beer)" />
              {BUBBLES.map((b, i) => {
                const h = shape.bottom - liquidTop;
                if (h < 12) return null;
                const y = shape.bottom - ((t * b.speed + b.offset) % h);
                const x = rx0 + (rx1 - rx0) * b.x;
                return <circle key={i} cx={x} cy={y} r={b.r} fill="#FFF3C4" opacity="0.65" />;
              })}
              {engine.foam > 0.004 && <path d={foamPath} fill="url(#pp-foam)" />}
              {/* Gravure du logo */}
              <g opacity="0.22" fill="none" stroke="#2A1A05" strokeWidth="2.4">
                <path d="M178 238 L222 278 M222 238 L178 278" />
                <circle cx="176" cy="282" r="6" />
                <circle cx="224" cy="282" r="6" />
              </g>
              <text x="200" y="266" fontSize="20" fontWeight="900" fill="#2A1A05" opacity="0.25" textAnchor="middle" letterSpacing="2">
                CUTSHOP
              </text>
            </g>

            {/* Zone parfaite (niveau visé après retombée de la mousse) */}
            <g data-testid="pour-zone">
              <rect x={rx0 - 22} y={zoneTop} width="12" height={Math.max(2, zoneBottom - zoneTop)} rx="3" fill="#7CE3A0" />
              <rect x={rx1 + 10} y={zoneTop} width="12" height={Math.max(2, zoneBottom - zoneTop)} rx="3" fill="#7CE3A0" />
              <line x1={rx0 - 6} x2={rx1 + 6} y1={(zoneTop + zoneBottom) / 2} y2={(zoneTop + zoneBottom) / 2} stroke="#7CE3A0" strokeWidth="1.5" strokeDasharray="5 6" opacity="0.6" />
            </g>

            {/* Paroi du verre */}
            <path d={shape.outer} fill="url(#pp-glass)" stroke="rgba(255,255,255,0.7)" strokeWidth="3" />
            <path d={shape.inner} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" />
            <path d={`M${rx0 + 10} ${shape.rim + 18} C${rx0 + 2} ${shape.rim + 80} ${rx0 + 4} ${shape.bottom - 60} ${rx0 + 18} ${shape.bottom - 24}`} stroke="#FFFFFF" strokeOpacity="0.45" strokeWidth="5" fill="none" strokeLinecap="round" />

            {/* Débordement */}
            {overflow && (
              <g opacity={Math.max(0, 1 - popupAge / 900)}>
                <path d={`M${rx0 - 6} ${shape.rim} C${rx0 - 20} ${shape.rim + 40} ${rx0 - 14} ${shape.rim + 90} ${rx0 - 26} ${shape.rim + 120 + popupAge / 8}`} stroke="#FFF7E2" strokeWidth="12" strokeLinecap="round" fill="none" />
                <path d={`M${rx1 + 6} ${shape.rim} C${rx1 + 20} ${shape.rim + 50} ${rx1 + 12} ${shape.rim + 80} ${rx1 + 24} ${shape.rim + 110 + popupAge / 7}`} stroke="#FFF7E2" strokeWidth="10" strokeLinecap="round" fill="none" />
              </g>
            )}

            {/* Lueur quand c'est parfait */}
            {popup?.grade === 'perfect' && (
              <path d={shape.outer} fill="none" stroke="#F6C445" strokeWidth="10" opacity={Math.max(0, 0.8 - popupAge / 1000)} filter="url(#pp-glow)" />
            )}
          </svg>

          {/* Note du verre */}
          {popup && (
            <div className="pointer-events-none absolute inset-x-0 top-[34%] text-center" data-testid="pour-grade" data-grade={popup.grade}>
              <p
                className="inline-flex items-center gap-3 rounded-full bg-black/60 px-6 py-2 text-[2.4rem] font-black uppercase italic tracking-wide backdrop-blur animate-pop"
                style={{ color: GRADE_COLOR[popup.grade], textShadow: `0 0 18px ${GRADE_COLOR[popup.grade]}88` }}
              >
                {popup.grade === 'perfect' && <Star size={34} fill="currentColor" />}
                {txt.grades[popup.grade]}
              </p>
              {popup.points + popup.bonus > 0 && (
                <p className="mt-2 text-3xl font-black text-cream drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)]">
                  +{popup.points}
                  {popup.bonus > 0 && <span className="ml-2 text-gold">+{popup.bonus}</span>}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Jauge et bouton */}
        <aside className="flex min-h-0 flex-col justify-center gap-4">
          <div className="rounded-3xl bg-black/55 p-4 ring-1 ring-white/15 backdrop-blur" data-testid="pour-gauge">
            <div className="flex gap-3">
              <div className="relative h-60 w-10 shrink-0 overflow-hidden rounded-xl bg-white/10 ring-1 ring-white/20">
                <div className="absolute inset-x-0 top-0 bg-[#FF7A6B]/35" style={{ height: `${100 - g(spec.target + spec.tol)}%` }} />
                <div className="absolute inset-x-0 bg-[#7CE3A0]/85" style={{ bottom: `${g(spec.target - spec.tol)}%`, height: `${g(spec.target + spec.tol) - g(spec.target - spec.tol)}%` }} />
                <div className="absolute inset-x-0 bottom-0 bg-[#F2A33A]/30" style={{ height: `${g(spec.target - spec.tol)}%` }} />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#C97A12] to-[#FFD766] opacity-90" style={{ height: `${g(gaugeLevel)}%` }} />
                <div className="absolute inset-x-0 h-1 bg-white shadow-[0_0_8px_white]" style={{ bottom: `calc(${g(gaugeLevel)}% - 2px)` }} />
              </div>
              <div className="relative h-60 min-w-0 flex-1 whitespace-nowrap text-[0.8rem] font-black uppercase leading-none">
                <span className="absolute left-0 top-0 text-[#FF9C90]">{txt.tooMuch}</span>
                <span className="absolute left-0 translate-y-1/2 text-[#7CE3A0]" style={{ bottom: `${g(spec.target)}%` }}>
                  ◀ {txt.perfectZone}
                </span>
                <span className="absolute bottom-0 left-0 text-[#F7B866]">{txt.notEnough}</span>
              </div>
            </div>
          </div>
          <button
            type="button"
            className={`flex min-h-[120px] w-full flex-col items-center justify-center rounded-3xl border-4 px-3 text-center text-xl font-black uppercase leading-tight tracking-wide transition ${
              pouring ? 'scale-[0.97] border-gold bg-gold text-bottle-950 shadow-[0_0_36px_rgba(212,168,75,0.7)]' : 'border-gold/70 bg-black/55 text-gold'
            }`}
            onPointerDown={onDown}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onLostPointerCapture={onUp}
            data-testid="pour-hold"
          >
            {pouring ? txt.pouring : txt.hold}
          </button>
          <p className="text-center text-sm font-bold leading-snug text-cream/70">{txt.hint}</p>
        </aside>
      </div>
    </div>
  );
}
