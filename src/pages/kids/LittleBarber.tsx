import { Palette, RotateCcw, Scissors, Sprout } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { ClipperIcon, CombIcon } from '../../components/Icons';
import { Page, PageHeader } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { seededRandom } from '../../lib/random';

type Tool = 'clipper' | 'scissors' | 'comb' | 'color' | 'grow';

interface Strand {
  bx: number;
  by: number;
  /** Direction en radians. */
  dir: number;
  len: number;
  max: number;
  curl: number;
  color: string;
  width: number;
}

const HEAD = { cx: 200, cy: 250, r: 112 };
const HAIR_BROWN = '#5B3A29';
const COLORS = ['#5B3A29', '#1F1A17', '#F2C14E', '#FF5D8F', '#3A86FF', '#2EC4B6', '#9B5DE5', '#FF7A00'];

function buildStrands(): Strand[] {
  const rand = seededRandom(2018);
  const out: Strand[] = [];
  // Cheveux : base sur le haut du crâne.
  for (let i = 0; i < 90; i++) {
    const a = Math.PI + (i / 89) * Math.PI;
    const r = HEAD.r - 6 - rand() * 14;
    const len = 62 + rand() * 40;
    out.push({
      bx: HEAD.cx + r * Math.cos(a),
      by: HEAD.cy + r * Math.sin(a) * 0.95 - 8,
      dir: a + (rand() - 0.5) * 0.5,
      len,
      max: len + 30,
      curl: (rand() - 0.5) * 50,
      color: HAIR_BROWN,
      width: 10,
    });
  }
  // Barbe : base sur la mâchoire.
  for (let i = 0; i < 46; i++) {
    const a = 0.25 * Math.PI + (i / 45) * 0.5 * Math.PI;
    const r = HEAD.r - 18 - rand() * 10;
    const len = 34 + rand() * 26;
    out.push({
      bx: HEAD.cx + r * Math.cos(a),
      by: HEAD.cy + r * Math.sin(a),
      dir: a + (rand() - 0.5) * 0.4,
      len,
      max: len + 25,
      curl: (rand() - 0.5) * 26,
      color: HAIR_BROWN,
      width: 9,
    });
  }
  return out;
}

function strandPath(s: Strand): string {
  const ex = s.bx + Math.cos(s.dir) * s.len;
  const ey = s.by + Math.sin(s.dir) * s.len;
  const mx = (s.bx + ex) / 2 + Math.cos(s.dir + Math.PI / 2) * s.curl * (s.len / 100);
  const my = (s.by + ey) / 2 + Math.sin(s.dir + Math.PI / 2) * s.curl * (s.len / 100);
  return `M${s.bx.toFixed(1)},${s.by.toFixed(1)} Q${mx.toFixed(1)},${my.toFixed(1)} ${ex.toFixed(1)},${ey.toFixed(1)}`;
}

const TOOLS: { key: Tool; icon: ReactElement; bg: string }[] = [
  { key: 'clipper', icon: <ClipperIcon size={40} />, bg: 'bg-[#3A86FF]' },
  { key: 'scissors', icon: <Scissors size={40} />, bg: 'bg-[#FF5D8F]' },
  { key: 'comb', icon: <CombIcon size={40} />, bg: 'bg-[#2EC4B6]' },
  { key: 'color', icon: <Palette size={40} />, bg: 'bg-[#9B5DE5]' },
  { key: 'grow', icon: <Sprout size={40} />, bg: 'bg-[#FF9F1C]' },
];

export default function LittleBarber() {
  const { t } = useTranslation();
  const { tablet } = useApp();
  const initial = useMemo(buildStrands, []);
  const strands = useRef<Strand[]>(initial.map((s) => ({ ...s })));
  const [, setVersion] = useState(0);
  const [tool, setTool] = useState<Tool>('scissors');
  const [color, setColor] = useState(COLORS[3]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const frame = useRef(0);
  const logged = useRef(false);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const redraw = () => {
    if (frame.current) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = 0;
      setVersion((v) => v + 1);
    });
  };

  const toSvg = (e: RPointerEvent<SVGSVGElement>) => {
    const svg = svgRef.current!;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const m = svg.getScreenCTM();
    return m ? pt.matrixTransform(m.inverse()) : pt;
  };

  const apply = useCallback(
    (x: number, y: number) => {
      for (const s of strands.current) {
        const dx = Math.cos(s.dir);
        const dy = Math.sin(s.dir);
        const px = x - s.bx;
        const py = y - s.by;
        const along = px * dx + py * dy;
        const across = Math.abs(-px * dy + py * dx);
        const near = Math.hypot(x - (s.bx + dx * s.len * 0.6), y - (s.by + dy * s.len * 0.6));
        if (tool === 'scissors') {
          if (across < 16 && along > 4 && along < s.len) s.len = Math.max(4, along);
        } else if (tool === 'clipper') {
          if (near < 42 || (across < 26 && along > 0 && along < s.len)) s.len = Math.min(s.len, 7);
        } else if (tool === 'comb') {
          if (near < 50 || (across < 30 && along > 0 && along < s.len)) s.curl *= 0.6;
        } else if (tool === 'color') {
          if (near < 46 || (across < 22 && along > 0 && along < s.len)) s.color = color;
        } else if (tool === 'grow') {
          if (Math.hypot(x - s.bx, y - s.by) < 70) s.len = Math.min(s.max, s.len + 3);
        }
      }
      redraw();
    },
    [tool, color],
  );

  const onDown = (e: RPointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const p = toSvg(e);
    setCursor({ x: p.x, y: p.y });
    apply(p.x, p.y);
    if (!logged.current) {
      logged.current = true;
      void api.logPlay('barber', 1, null, tablet ?? '').catch(() => undefined);
    }
  };
  const onMove = (e: RPointerEvent<SVGSVGElement>) => {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const p = toSvg(e);
    setCursor({ x: p.x, y: p.y });
    apply(p.x, p.y);
  };

  const reset = () => {
    strands.current = initial.map((s) => ({ ...s }));
    setVersion((v) => v + 1);
  };

  const toolIcon = TOOLS.find((x) => x.key === tool)!;

  return (
    <Page>
      <PageHeader title={t('kids.barber')} back="/kids" />
      <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
        <div className="overflow-hidden rounded-[2.5rem] bg-gradient-to-b from-[#BDE0FE] to-[#FFC8DD] shadow-tile">
          <svg
            ref={svgRef}
            viewBox="0 0 400 480"
            className="mx-auto block h-[calc(100dvh-230px)] max-h-[680px] min-h-[380px] w-full touch-none"
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={() => setCursor(null)}
            onPointerLeave={() => setCursor(null)}
            data-testid="barber-canvas"
          >
            {/* Cape de barbier */}
            <path d="M60 480 C70 380 140 350 200 350 C260 350 330 380 340 480 Z" fill="#164734" />
            <path d="M100 480 L120 380 M150 480 L160 362 M200 480 L200 356 M250 480 L240 362 M300 480 L280 380" stroke="#D4A84B" strokeWidth="6" opacity="0.5" />
            <rect x="178" y="330" width="44" height="34" rx="10" fill="#F2B989" />
            {/* Oreilles */}
            <ellipse cx="86" cy="262" rx="20" ry="28" fill="#F2B989" />
            <ellipse cx="314" cy="262" rx="20" ry="28" fill="#F2B989" />
            {/* Visage */}
            <circle cx={HEAD.cx} cy={HEAD.cy} r={HEAD.r} fill="#F7C79A" />
            <ellipse cx="148" cy="290" rx="16" ry="10" fill="#FF8FA3" opacity="0.5" />
            <ellipse cx="252" cy="290" rx="16" ry="10" fill="#FF8FA3" opacity="0.5" />
            <g className="origin-center">
              <ellipse cx="160" cy="250" rx="15" ry="18" fill="#fff" />
              <ellipse cx="240" cy="250" rx="15" ry="18" fill="#fff" />
              <circle cx={162 + (cursor ? Math.max(-5, Math.min(5, (cursor.x - 160) / 30)) : 0)} cy={254 + (cursor ? Math.max(-5, Math.min(5, (cursor.y - 250) / 30)) : 0)} r="8" fill="#1F1A17" />
              <circle cx={242 + (cursor ? Math.max(-5, Math.min(5, (cursor.x - 240) / 30)) : 0)} cy={254 + (cursor ? Math.max(-5, Math.min(5, (cursor.y - 250) / 30)) : 0)} r="8" fill="#1F1A17" />
            </g>
            <path d="M194 268 Q200 290 206 268" stroke="#D9895B" strokeWidth="5" fill="none" strokeLinecap="round" />
            <path d="M168 305 Q200 335 232 305" stroke="#B5523B" strokeWidth="7" fill="none" strokeLinecap="round" />
            {/* Cheveux et barbe */}
            <g>
              {strands.current.map((s, i) => (
                <path key={i} d={strandPath(s)} stroke={s.color} strokeWidth={s.width} strokeLinecap="round" fill="none" />
              ))}
            </g>
            {cursor && (
              <g transform={`translate(${cursor.x - 26} ${cursor.y - 26})`} pointerEvents="none">
                <circle cx="26" cy="26" r="28" fill="white" opacity="0.85" />
                <g transform="translate(6 6)" color="#164734">
                  {toolIcon.icon}
                </g>
              </g>
            )}
          </svg>
        </div>

        <div className="flex flex-row flex-wrap content-start justify-center gap-3 lg:grid lg:w-[232px] lg:grid-cols-2">
          {TOOLS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setTool(x.key)}
              className={`flex h-[110px] w-[110px] flex-col items-center justify-center gap-1 rounded-3xl text-white shadow-tile transition active:scale-95 ${x.bg} ${tool === x.key ? 'ring-8 ring-white scale-105' : 'opacity-80'}`}
              aria-label={t(`kids.tools.${x.key}`)}
              aria-pressed={tool === x.key}
              data-testid={`tool-${x.key}`}
            >
              {x.icon}
              <span className="text-sm font-black uppercase">{t(`kids.tools.${x.key}`)}</span>
            </button>
          ))}
          <button type="button" onClick={reset} className="flex h-[110px] w-[110px] items-center justify-center rounded-3xl bg-white text-bottle-900 shadow-tile active:scale-95" aria-label={t('common.restart')} data-testid="barber-reset">
            <RotateCcw size={44} />
          </button>
        </div>
      </div>
      {tool === 'color' && (
        <div className="mt-5 flex flex-wrap justify-center gap-4 animate-fade-up">
          {COLORS.map((c) => (
            <button key={c} type="button" onClick={() => setColor(c)} className={`h-[72px] w-[72px] rounded-full shadow-tile transition active:scale-90 ${color === c ? 'ring-8 ring-white' : ''}`} style={{ background: c }} aria-label={c} />
          ))}
        </div>
      )}
    </Page>
  );
}
