// Find It Cutshop : scène illustrée à gauche, liste des 5 objets à droite. Toucher un objet de la liste le marque trouvé.
// Course (race) : chacun joue la même suite de scènes. Chasse (hunt) : objets partagés, le serveur attribue chaque objet au plus rapide.
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { sfx } from '../../audio';
import type { TableNo } from '../../types';
import type { GameProps } from '../types';
import { ArtDefs, ObjectIcon } from './art';
import { BONUS_MS, FinditEngine, MAX_SCENES, objectId, type TapOutcome } from './engine';
import { SceneArt } from './scenes';
import { OBJECT_NAMES, SCENE_H, SCENE_W, SCENES, type ObjectKey } from './sceneData';

const TXT = {
  fr: {
    find: 'TROUVE CES OBJETS',
    scene: 'Scène',
    round: 'Manche',
    bonus: 'Bonus vitesse',
    perfect: 'SCÈNE PARFAITE !',
    cleared: 'SCÈNE TERMINÉE !',
    roundOver: 'MANCHE TERMINÉE !',
    allDone: 'TOUTES LES SCÈNES !',
    waitEnd: 'Bravo, attends la fin du chrono',
    takenBy: (n: number) => `Table ${n} l’a trouvé`,
    yours: 'Pour toi !',
    checking: 'Vérification',
    drag: 'Glisse pour explorer',
    zoomIn: 'Zoom x2',
    zoomOut: 'Vue x1',
    myFinds: 'Tes objets',
    misses: 'Erreurs',
    clean: 'Sans erreur',
    hunt: 'Chasse',
    race: 'Course',
    nextScene: 'Scène suivante',
    nextRound: 'Manche suivante',
    youGot: (n: number) => `Tu en as trouvé ${n}`,
  },
  en: {
    find: 'FIND THESE ITEMS',
    scene: 'Scene',
    round: 'Round',
    bonus: 'Speed bonus',
    perfect: 'PERFECT SCENE !',
    cleared: 'SCENE CLEARED !',
    roundOver: 'ROUND OVER !',
    allDone: 'ALL SCENES DONE !',
    waitEnd: 'Well done, wait for the timer',
    takenBy: (n: number) => `Table ${n} found it`,
    yours: 'Yours !',
    checking: 'Checking',
    drag: 'Drag to explore',
    zoomIn: 'Zoom x2',
    zoomOut: 'View x1',
    myFinds: 'Your finds',
    misses: 'Misses',
    clean: 'No miss',
    hunt: 'Hunt',
    race: 'Race',
    nextScene: 'Next scene',
    nextRound: 'Next round',
    youGot: (n: number) => `You found ${n}`,
  },
};

const TABLE_COLORS: Record<TableNo, string> = { 1: '#4FC3F7', 2: '#FF6FA1', 3: '#9BE15D', 4: '#FFB547' };
const GOLD = '#F4C95D';
const PANEL_W = 300;
const GAP = 14;
/** Déplacement (px) au delà duquel un appui devient un glissé en mode zoom. */
const DRAG_PX = 12;

interface Popup {
  id: number;
  x: number;
  y: number;
  text: string;
  color: string;
  kind: 'good' | 'bad' | 'info';
}

export default function FindIt(props: GameProps) {
  const { seed, variant, startAt, durationMs, lang } = props;
  const t = TXT[lang] ?? TXT.fr;
  const propsRef = useRef(props);
  propsRef.current = props;
  const me: TableNo = props.myTable ?? 1;

  const engineRef = useRef<FinditEngine | null>(null);
  if (!engineRef.current) {
    engineRef.current = new FinditEngine(seed, variant, durationMs, me);
    engineRef.current.start(startAt);
  }
  const engine = engineRef.current;
  const hunt = engine.variant === 'hunt';

  const [, setTick] = useState(0);
  const versionRef = useRef(-1);
  const endedRef = useRef(false);
  const aliveRef = useRef(true);
  const lastLiveRef = useRef(-1);
  const [popups, setPopups] = useState<Popup[]>([]);
  const popupId = useRef(0);

  const wrapRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const bonusRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState<1 | 2>(1);
  const view = useRef({ x: 0, y: 0, w: SCENE_W, h: SCENE_H });
  const drag = useRef<{ id: number; sx: number; sy: number; vx: number; vy: number; moved: boolean; at: number } | null>(null);

  // Taille du cadre de scène : le plus grand rectangle 10/7 qui tient à gauche du panneau.
  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      const availW = Math.max(100, r.width - PANEL_W - GAP * 3);
      const availH = Math.max(100, r.height - GAP * 2);
      const w = Math.min(availW, (availH * SCENE_W) / SCENE_H);
      setBox({ w: Math.floor(w), h: Math.floor((w * SCENE_H) / SCENE_W) });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const applyView = useCallback(() => {
    const v = view.current;
    svgRef.current?.setAttribute('viewBox', `${v.x} ${v.y} ${v.w} ${v.h}`);
  }, []);

  const setZoomAt = useCallback(
    (z: 1 | 2, cx = SCENE_W / 2, cy = SCENE_H / 2) => {
      const w = SCENE_W / z;
      const h = SCENE_H / z;
      view.current = {
        w,
        h,
        x: Math.min(SCENE_W - w, Math.max(0, cx - w / 2)),
        y: Math.min(SCENE_H - h, Math.max(0, cy - h / 2)),
      };
      applyView();
      setZoom(z);
    },
    [applyView],
  );

  const addPopup = useCallback((p: Omit<Popup, 'id'>, ms = 900) => {
    const id = ++popupId.current;
    setPopups((l) => [...l.slice(-6), { ...p, y: Math.max(48, p.y), id }]);
    window.setTimeout(() => {
      if (aliveRef.current) setPopups((l) => l.filter((x) => x.id !== id));
    }, ms);
  }, []);

  const shake = useCallback(() => {
    const el = frameRef.current;
    if (!el) return;
    el.classList.remove('fi-shake');
    void el.offsetWidth;
    el.classList.add('fi-shake');
  }, []);

  const placementOf = (key: ObjectKey) => SCENES[engine.round.scene].objects.find((o) => o.key === key);

  // Boucle d'affichage : avance le moteur, redessine seulement si l'état visible a changé.
  useEffect(() => {
    aliveRef.current = true;
    let raf = 0;
    const loop = () => {
      const p = propsRef.current;
      const now = p.clock();
      engine.update(now);
      if (bonusRef.current) {
        const left = engine.variant === 'race' && engine.phase === 'play' && now >= engine.startedAt ? Math.max(0, 1 - (now - engine.roundStartedAt) / BONUS_MS) : 0;
        bonusRef.current.style.transform = `scaleX(${left})`;
      }
      const live = engine.liveScore();
      if (live !== lastLiveRef.current) {
        lastLiveRef.current = live;
        p.onLive(live);
      }
      if (!endedRef.current && now >= p.startAt + p.durationMs) {
        endedRef.current = true;
        engine.finish(now);
        sfx('end', p.sound);
        p.onEnd(engine.result());
      }
      if (engine.version !== versionRef.current) {
        versionRef.current = engine.version;
        setTick((x) => x + 1);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      aliveRef.current = false;
      cancelAnimationFrame(raf);
      engine.dispose();
    };
  }, [engine]);

  // Chasse : attributions du serveur.
  useEffect(() => {
    if (hunt) engine.syncClaims(propsRef.current.clock(), props.claims);
  }, [engine, hunt, props.claims]);

  // Nouvelle scène : retour à la vue entière.
  const roundIndex = engine.round.index;
  useEffect(() => {
    setZoomAt(1);
  }, [roundIndex, setZoomAt]);

  const handleOutcome = useCallback(
    (out: TapOutcome, x: number, y: number) => {
      const p = propsRef.current;
      switch (out.kind) {
        case 'found': {
          sfx(out.cleared ? (out.clean ? 'combo' : 'perfect') : 'found', p.sound);
          const at = placementOf(out.key);
          addPopup({ x: at?.x ?? x, y: (at?.y ?? y) - 40, text: `+${out.points + out.bonus}`, color: GOLD, kind: 'good' });
          break;
        }
        case 'wrong': {
          sfx('bad', p.sound);
          shake();
          addPopup({ x, y, text: '✕', color: '#FF5A5A', kind: 'bad' }, 700);
          break;
        }
        case 'taken': {
          sfx('tap', p.sound);
          const at = placementOf(out.key);
          addPopup({ x: at?.x ?? x, y: (at?.y ?? y) - 44, text: t.takenBy(out.owner), color: TABLE_COLORS[out.owner], kind: 'info' }, 1100);
          break;
        }
        case 'claim': {
          sfx('tap', p.sound);
          const at = placementOf(out.key);
          const px = at?.x ?? x;
          const py = (at?.y ?? y) - 44;
          const resolve = (res: { won: boolean; owner: TableNo } | null) => {
            if (!aliveRef.current) return;
            const now = propsRef.current.clock();
            engine.resolveClaim(now, out.id, res);
            if (!res) return;
            if (res.owner === engine.me) {
              sfx('found', propsRef.current.sound);
              addPopup({ x: px, y: py, text: '+100', color: GOLD, kind: 'good' });
            } else {
              sfx('bad', propsRef.current.sound);
              addPopup({ x: px, y: py, text: t.takenBy(res.owner), color: TABLE_COLORS[res.owner], kind: 'info' }, 1300);
            }
          };
          if (p.claim) {
            p.claim(out.id).then(resolve, () => resolve(null));
          } else {
            // Sans serveur (aperçu solo) : l'objet est attribué localement.
            resolve({ won: true, owner: engine.me });
          }
          break;
        }
        case 'ignored':
          break;
      }
    },
    [engine, hunt, addPopup, shake, t],
  );

  const toScene = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const m = svg.getScreenCTM();
    if (!m) return null;
    const pt = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return { x: pt.x, y: pt.y };
  };

  const tapAt = (clientX: number, clientY: number, when: number) => {
    const s = toScene(clientX, clientY);
    if (!s) return;
    const out = engine.tap(when, s.x, s.y);
    handleOutcome(out, s.x, s.y);
  };

  const onPointerDown = (e: ReactPointerEvent<SVGSVGElement>) => {
    const now = props.clock();
    if (now < startAt || endedRef.current) return;
    if (zoom === 1) {
      tapAt(e.clientX, e.clientY, now);
      return;
    }
    if (drag.current) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, vx: view.current.x, vy: view.current.y, moved: false, at: now };
  };

  const onPointerMove = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved && Math.hypot(dx, dy) < DRAG_PX) return;
    d.moved = true;
    const k = view.current.w / Math.max(1, box.w);
    view.current.x = Math.min(SCENE_W - view.current.w, Math.max(0, d.vx - dx * k));
    view.current.y = Math.min(SCENE_H - view.current.h, Math.max(0, d.vy - dy * k));
    applyView();
  };

  const onPointerUp = (e: ReactPointerEvent<SVGSVGElement>) => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.moved) tapAt(d.sx, d.sy, d.at);
  };

  const onPointerCancel = (e: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };

  const toggleZoom = () => {
    if (zoom === 1) setZoomAt(2);
    else setZoomAt(1);
  };

  // ---------------------------------------------------------------------------
  // Rendu

  const round = engine.round;
  const scene = SCENES[round.scene];
  const placements = scene.objects;
  const phase = engine.phase;

  type ItemState = { kind: 'open' } | { kind: 'found' } | { kind: 'pending' } | { kind: 'mine' } | { kind: 'other'; owner: TableNo };
  const itemState = (key: ObjectKey): ItemState => {
    if (!hunt) return engine.found.has(key) ? { kind: 'found' } : { kind: 'open' };
    const id = objectId(round.index, key);
    const owner = engine.ownerOf(key);
    if (owner === engine.me) return { kind: 'mine' };
    if (owner) return { kind: 'other', owner };
    if (engine.pending.has(id)) return { kind: 'pending' };
    return { kind: 'open' };
  };
  const items = round.targets.map((key) => ({ key, st: itemState(key), at: placements.find((p) => p.key === key)! }));
  const myRoundFinds = items.filter((i) => i.st.kind === 'mine' || i.st.kind === 'found').length;

  return (
    <div ref={wrapRef} className="relative h-full w-full overflow-hidden select-none touch-none">
      <style>{CSS}</style>
      <svg width={0} height={0} className="absolute" aria-hidden>
        <ArtDefs />
      </svg>

      {/* Cadre de la scène */}
      <div
        ref={frameRef}
        className="absolute overflow-hidden rounded-[22px]"
        style={{
          left: GAP,
          top: '50%',
          width: box.w,
          height: box.h,
          marginTop: -box.h / 2,
          boxShadow: '0 0 0 2px rgba(212,168,75,0.55), 0 0 30px rgba(61,255,160,0.15), 0 18px 50px rgba(0,0,0,0.6)',
          background: '#0A2219',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 ${SCENE_W} ${SCENE_H}`}
          width={box.w}
          height={box.h}
          className="block"
          style={{ touchAction: 'none' }}
          data-testid="findit-scene"
          data-round={round.index}
          // Objets restants de la manche (repère de la scène), pour les tests automatisés.
          data-open={items
            .filter((i) => i.st.kind === 'open')
            .map((i) => `${i.key}@${i.at.x},${i.at.y}`)
            .join(';')}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
        >
          <SceneArt scene={round.scene} lang={lang === 'en' ? 'en' : 'fr'} />
          {/* Objets trouvés ou attribués */}
          {items.map(({ key, st, at }) => {
            if (st.kind === 'open') return null;
            const r = Math.max(34, 50 * at.s);
            const color = st.kind === 'other' ? TABLE_COLORS[st.owner] : st.kind === 'pending' ? '#FFFFFF' : GOLD;
            return (
              <g key={`${round.index}-${key}`} transform={`translate(${at.x} ${at.y})`} pointerEvents="none">
                {st.kind === 'pending' ? (
                  <circle r={r} fill="none" stroke={color} strokeWidth={4} strokeDasharray="14 10" className="fi-spin" />
                ) : (
                  <g className="fi-ring">
                    <circle r={r + 6} fill={color} opacity={0.16} />
                    <circle r={r} fill="none" stroke={color} strokeWidth={5} />
                    <circle r={r + 10} fill="none" stroke={color} strokeWidth={1.5} opacity={0.6} />
                    {[0, 72, 144, 216, 288].map((a) => (
                      <path key={a} d="M0 -6 L1.8 -1.8 L6 0 L1.8 1.8 L0 6 L-1.8 1.8 L-6 0 L-1.8 -1.8 Z" fill="#FFF6D8" transform={`rotate(${a}) translate(0 ${-(r + 10)}) scale(1.3)`} className="fi-sparkle" />
                    ))}
                    {st.kind === 'other' && (
                      <g transform={`translate(${r * 0.72} ${-r * 0.72})`}>
                        <circle r={15} fill={color} stroke="#0A2219" strokeWidth={3} />
                        <text y={6} textAnchor="middle" fontSize={17} fontWeight={800} fill="#0A2219">{st.owner}</text>
                      </g>
                    )}
                  </g>
                )}
              </g>
            );
          })}
          {/* Popups de points */}
          {popups.map((p) => (
            <g key={p.id} transform={`translate(${p.x} ${p.y})`} pointerEvents="none">
              <text
                className={p.kind === 'bad' ? 'fi-pop-bad' : 'fi-pop'}
                textAnchor="middle"
                fontSize={p.kind === 'info' ? 24 : 38}
                fontWeight={900}
                fill={p.color}
                stroke="#0A2219"
                strokeWidth={p.kind === 'info' ? 5 : 7}
                paintOrder="stroke"
              >
                {p.text}
              </text>
            </g>
          ))}
        </svg>

        {/* Célébration entre deux scènes */}
        {(phase === 'cleared' || phase === 'done') && (
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center bg-black/45">
            <div key={`clear-${round.index}`} className="fi-banner text-center">
              <div
                className="bg-gradient-to-b from-[#FFF3C4] via-[#F4C95D] to-[#B88C33] bg-clip-text text-[64px] font-black italic leading-none text-transparent"
                style={{ filter: 'drop-shadow(0 4px 0 #0A2219) drop-shadow(0 0 22px rgba(244,201,93,0.55))' }}
              >
                {phase === 'done' ? t.allDone : hunt ? t.roundOver : engine.lastClear?.clean ? t.perfect : t.cleared}
              </div>
              {!hunt && engine.lastClear?.clean && phase !== 'done' && (
                <div className="mt-3 text-[34px] font-black text-[#3DFFA0]" style={{ textShadow: '0 0 18px rgba(61,255,160,0.6), 0 3px 0 #0A2219' }}>
                  {t.clean} +200
                </div>
              )}
              {hunt && (
                <div className="mt-3 text-[28px] font-bold text-cream-100" style={{ textShadow: '0 3px 0 #0A2219' }}>
                  {t.youGot(myRoundFinds)}
                </div>
              )}
              <div className="mt-4 text-[20px] font-bold uppercase tracking-[0.3em] text-cream-200/80">
                {phase === 'done' ? t.waitEnd : hunt ? t.nextRound : t.nextScene}
              </div>
            </div>
          </div>
        )}

        {zoom === 2 && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-5 py-2 text-[17px] font-semibold text-cream-100 ring-1 ring-white/15">
            {t.drag}
          </div>
        )}
      </div>

      {/* Panneau de droite */}
      <div className="absolute flex flex-col" style={{ right: GAP, top: GAP, bottom: GAP, width: PANEL_W }}>
        <div className="flex items-center justify-between px-1 pb-2">
          <div className="text-[15px] font-bold uppercase tracking-[0.18em] text-gold-300">
            {hunt ? `${t.round} ${round.index + 1}` : `${t.scene} ${Math.min(round.index + 1, MAX_SCENES)} / ${MAX_SCENES}`}
          </div>
          <div className="truncate pl-2 text-[15px] font-semibold text-cream-200/80">{scene.name[lang] ?? scene.name.fr}</div>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col rounded-[22px] p-3"
          style={{
            background: 'linear-gradient(180deg, rgba(248,242,230,0.97), rgba(232,217,188,0.95))',
            boxShadow: '0 0 0 2px rgba(212,168,75,0.7), 0 16px 40px rgba(0,0,0,0.55)',
          }}
        >
          <div className="mb-2 text-center text-[17px] font-black tracking-[0.12em] text-bottle-900">{t.find}</div>
          <div className="flex min-h-0 flex-1 flex-col justify-between gap-2">
            {items.map(({ key, st }) => {
              const done = st.kind !== 'open' && st.kind !== 'pending';
              const color = st.kind === 'other' ? TABLE_COLORS[st.owner] : GOLD;
              return (
                <div
                  key={`${round.index}-${key}`}
                  className={`relative flex min-h-0 flex-1 items-center gap-3 rounded-2xl px-2 transition-colors duration-300 ${done ? 'fi-item-done' : ''}`}
                  style={{
                    background: st.kind === 'other' ? 'rgba(20,20,24,0.88)' : done ? 'linear-gradient(90deg, #164734, #0E2F23)' : 'rgba(255,255,255,0.75)',
                    boxShadow: done ? `inset 0 0 0 2px ${color}` : 'inset 0 0 0 1px rgba(14,47,35,0.15)',
                  }}
                >
                  <div className={`flex h-[58px] w-[58px] shrink-0 items-center justify-center rounded-xl ${done ? 'bg-white/10' : 'bg-bottle-900/[0.06]'}`}>
                    <ObjectIcon k={key} size={52} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`truncate text-[19px] font-bold leading-tight ${done ? 'text-cream-100' : 'text-bottle-900'} ${st.kind === 'other' ? 'line-through decoration-2 opacity-80' : ''}`}>
                      {OBJECT_NAMES[key][lang] ?? OBJECT_NAMES[key].fr}
                    </div>
                    {st.kind === 'other' && (
                      <div className="truncate text-[13px] font-semibold" style={{ color }}>
                        {t.takenBy(st.owner)}
                      </div>
                    )}
                    {st.kind === 'mine' && <div className="text-[13px] font-bold text-gold-300">{t.yours} +100</div>}
                    {st.kind === 'pending' && <div className="text-[13px] font-semibold text-bottle-600">{t.checking}…</div>}
                  </div>
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                    style={{
                      background: done ? color : 'transparent',
                      boxShadow: done ? `0 0 14px ${color}` : 'inset 0 0 0 3px rgba(14,47,35,0.35)',
                    }}
                  >
                    {done && st.kind !== 'other' && (
                      <svg width={22} height={22} viewBox="0 0 24 24" className="fi-check">
                        <path d="M4 12.5 L10 18 L20 6" fill="none" stroke="#0A2219" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                    {st.kind === 'other' && <span className="text-[17px] font-black text-[#0A2219]">{st.owner}</span>}
                    {st.kind === 'pending' && <span className="fi-spin-css block h-6 w-6 rounded-full border-[3px] border-bottle-600 border-t-transparent" />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bas du panneau : bonus de vitesse ou statistiques de chasse, puis zoom */}
        <div className="mt-3 rounded-2xl bg-black/55 px-4 py-2.5 ring-1 ring-white/10">
          {hunt ? (
            <div className="flex items-center justify-between text-[16px] font-semibold text-cream-100">
              <span>
                {t.myFinds} <span className="font-black text-gold-300">{engine.myClaims()}</span>
              </span>
              <span>
                {t.misses} <span className="font-black text-[#FF7A7A]">{engine.wrong}</span>
              </span>
            </div>
          ) : (
            <>
              <div className="mb-1.5 flex items-center justify-between text-[13px] font-bold uppercase tracking-[0.14em] text-cream-200/80">
                <span>{t.bonus}</span>
                <span className="text-[#3DFFA0]">+50</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/10">
                <div ref={bonusRef} className="h-full origin-left rounded-full bg-gradient-to-r from-[#3DFFA0] to-[#F4C95D]" style={{ transform: 'scaleX(1)' }} />
              </div>
            </>
          )}
        </div>
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            toggleZoom();
          }}
          className={`mt-3 flex h-[64px] items-center justify-center gap-3 rounded-2xl text-[21px] font-black tracking-wide transition-transform active:scale-95 ${
            zoom === 2 ? 'bg-gold-500 text-bottle-950' : 'bg-bottle-700 text-cream-100'
          }`}
          style={{ boxShadow: zoom === 2 ? '0 0 22px rgba(212,168,75,0.6)' : '0 0 0 2px rgba(212,168,75,0.5), 0 8px 20px rgba(0,0,0,0.4)' }}
        >
          <svg width={30} height={30} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
            <circle cx={10.5} cy={10.5} r={6.5} />
            <path d="M15.5 15.5 L21 21" />
            {zoom === 1 ? <path d="M10.5 7.5 V13.5 M7.5 10.5 H13.5" /> : <path d="M7.5 10.5 H13.5" />}
          </svg>
          {zoom === 1 ? t.zoomIn : t.zoomOut}
        </button>
      </div>
    </div>
  );
}

const CSS = `
@keyframes fi-shake { 0%,100% { transform: translateX(0) } 20% { transform: translateX(-12px) } 40% { transform: translateX(10px) } 60% { transform: translateX(-7px) } 80% { transform: translateX(4px) } }
.fi-shake { animation: fi-shake 0.38s ease-out; }
@keyframes fi-ring { 0% { transform: scale(0.3); opacity: 0 } 60% { transform: scale(1.15); opacity: 1 } 100% { transform: scale(1); opacity: 1 } }
.fi-ring { animation: fi-ring 0.45s cubic-bezier(.2,.9,.3,1.3) both; transform-box: fill-box; transform-origin: center; }
@keyframes fi-sparkle { 0% { opacity: 0 } 30% { opacity: 1 } 100% { opacity: 0 } }
.fi-sparkle { animation: fi-sparkle 0.9s ease-out 0.15s both; }
@keyframes fi-pop { 0% { transform: translateY(10px) scale(0.6); opacity: 0 } 25% { transform: translateY(0) scale(1.1); opacity: 1 } 70% { opacity: 1 } 100% { transform: translateY(-34px) scale(1); opacity: 0 } }
.fi-pop { animation: fi-pop 0.95s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes fi-pop-bad { 0% { transform: scale(1.5); opacity: 0 } 25% { transform: scale(1); opacity: 1 } 100% { transform: scale(0.9); opacity: 0 } }
.fi-pop-bad { animation: fi-pop-bad 0.7s ease-out both; transform-box: fill-box; transform-origin: center; }
@keyframes fi-spin { to { transform: rotate(360deg) } }
.fi-spin { animation: fi-spin 1.2s linear infinite; transform-box: fill-box; transform-origin: center; }
.fi-spin-css { animation: fi-spin 0.8s linear infinite; }
@keyframes fi-banner { 0% { transform: scale(0.5); opacity: 0 } 60% { transform: scale(1.08); opacity: 1 } 100% { transform: scale(1) } }
.fi-banner { animation: fi-banner 0.5s cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes fi-item { 0% { transform: scale(1) } 40% { transform: scale(1.05) } 100% { transform: scale(1) } }
.fi-item-done { animation: fi-item 0.4s ease-out; }
@keyframes fi-check { 0% { transform: scale(0) } 70% { transform: scale(1.3) } 100% { transform: scale(1) } }
.fi-check { animation: fi-check 0.35s ease-out both; }
`;
