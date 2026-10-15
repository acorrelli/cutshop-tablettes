import { Armchair, Droplets, PartyPopper, RotateCcw, Scissors, SprayCan, Star } from 'lucide-react';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import {
  BarberPoleIcon,
  ClipperIcon,
  CombIcon,
  MirrorIcon,
  MustacheIcon,
  RazorIcon,
  ShavingBrushIcon,
  TowelIcon,
} from '../../components/Icons';
import { Page, PageHeader } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { api } from '../../lib/api';
import { shuffle } from '../../lib/random';

type Level = 'easy' | 'medium' | 'hard';
const PAIRS: Record<Level, number> = { easy: 6, medium: 8, hard: 12 };
const COLS: Record<Level, string> = { easy: 'grid-cols-4', medium: 'grid-cols-4', hard: 'grid-cols-6' };
const GRID: Record<Level, [number, number]> = { easy: [4, 3], medium: [4, 4], hard: [6, 4] };

const FACES: { id: string; icon: ReactElement; bg: string }[] = [
  { id: 'scissors', icon: <Scissors size={56} />, bg: '#FF5D8F' },
  { id: 'comb', icon: <CombIcon size={56} />, bg: '#3A86FF' },
  { id: 'brush', icon: <ShavingBrushIcon size={56} />, bg: '#FF9F1C' },
  { id: 'mirror', icon: <MirrorIcon size={56} />, bg: '#2EC4B6' },
  { id: 'razor', icon: <RazorIcon size={56} />, bg: '#9B5DE5' },
  { id: 'clipper', icon: <ClipperIcon size={56} />, bg: '#164734' },
  { id: 'pole', icon: <BarberPoleIcon size={56} />, bg: '#E63946' },
  { id: 'mustache', icon: <MustacheIcon size={56} />, bg: '#8F6B22' },
  { id: 'spray', icon: <SprayCan size={56} />, bg: '#06A77D' },
  { id: 'chair', icon: <Armchair size={56} />, bg: '#4361EE' },
  { id: 'towel', icon: <TowelIcon size={56} />, bg: '#F72585' },
  { id: 'oil', icon: <Droplets size={56} />, bg: '#D4A84B' },
];

interface Card {
  uid: number;
  face: string;
  matched: boolean;
}

function deal(level: Level): Card[] {
  const faces = shuffle(FACES).slice(0, PAIRS[level]);
  return shuffle(faces.flatMap((f, i) => [
    { uid: i * 2, face: f.id, matched: false },
    { uid: i * 2 + 1, face: f.id, matched: false },
  ]));
}

export default function Memory() {
  const { t } = useTranslation();
  const { tablet } = useApp();
  const [level, setLevel] = useState<Level>('easy');
  const [cards, setCards] = useState<Card[]>(() => deal('easy'));
  const [open, setOpen] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const lock = useRef(false);
  const won = cards.length > 0 && cards.every((c) => c.matched);

  useEffect(() => {
    if (won) void api.logPlay('memory', 1, level, tablet ?? '').catch(() => undefined);
  }, [won, level, tablet]);

  const start = (l: Level) => {
    setLevel(l);
    setCards(deal(l));
    setOpen([]);
    setMoves(0);
    lock.current = false;
  };

  const flip = (uid: number) => {
    if (lock.current || open.includes(uid)) return;
    const card = cards.find((c) => c.uid === uid);
    if (!card || card.matched) return;
    const next = [...open, uid];
    setOpen(next);
    if (next.length === 2) {
      setMoves((m) => m + 1);
      const [a, b] = next.map((id) => cards.find((c) => c.uid === id)!);
      lock.current = true;
      if (a.face === b.face) {
        setTimeout(() => {
          setCards((cs) => cs.map((c) => (c.face === a.face ? { ...c, matched: true } : c)));
          setOpen([]);
          lock.current = false;
        }, 350);
      } else {
        setTimeout(() => {
          setOpen([]);
          lock.current = false;
        }, 900);
      }
    }
  };

  return (
    <Page>
      <PageHeader title={t('kids.memory')} back="/kids">
        <div className="flex gap-2">
          {(['easy', 'medium', 'hard'] as Level[]).map((l, i) => (
            <button
              key={l}
              type="button"
              onClick={() => start(l)}
              className={`flex min-h-[64px] items-center gap-1 rounded-2xl px-4 font-black text-white shadow-tile transition active:scale-95 ${['bg-[#2EC4B6]', 'bg-[#FF9F1C]', 'bg-[#FF5D8F]'][i]} ${level === l ? 'ring-4 ring-white' : 'opacity-75'}`}
              aria-label={t(`kids.levels.${l}`)}
              data-testid={`memory-${l}`}
            >
              {Array.from({ length: i + 1 }, (_, k) => (
                <Star key={k} size={22} fill="currentColor" />
              ))}
              <span className="ml-1 hidden text-base sm:inline">{t(`kids.levels.${l}`)}</span>
            </button>
          ))}
        </div>
      </PageHeader>

      <div
        className={`mx-auto grid gap-3 sm:gap-4 ${COLS[level]}`}
        // La grille entière tient dans l'écran : largeur calculée depuis la hauteur disponible.
        style={{ maxWidth: `min(100%, calc((100dvh - 250px) / ${GRID[level][1]} * ${GRID[level][0]}))` }}
        data-testid="memory-grid"
      >
        {cards.map((c) => {
          const face = FACES.find((f) => f.id === c.face)!;
          const shown = c.matched || open.includes(c.uid);
          return (
            <button
              key={c.uid}
              type="button"
              onClick={() => flip(c.uid)}
              className="relative aspect-square [perspective:900px]"
              aria-label={shown ? face.id : '?'}
              data-testid="memory-card"
              data-face={c.face}
            >
              <span className={`absolute inset-0 transition-transform duration-500 [transform-style:preserve-3d] ${shown ? '[transform:rotateY(180deg)]' : ''}`}>
                <span className="absolute inset-0 grid place-items-center rounded-3xl bg-gradient-to-br from-gold-400 to-gold-700 shadow-tile ring-4 ring-white/30 [backface-visibility:hidden]">
                  <span className="text-5xl font-black text-bottle-950/40">?</span>
                </span>
                <span
                  className={`absolute inset-0 grid place-items-center rounded-3xl text-white shadow-tile [backface-visibility:hidden] [transform:rotateY(180deg)] ${c.matched ? 'ring-4 ring-white' : ''}`}
                  style={{ background: face.bg }}
                >
                  {face.icon}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-5 text-center text-xl font-bold text-cream/70">{t('kids.moves', { n: moves })}</p>

      {won && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-6 backdrop-blur" data-testid="memory-win">
          <div className="w-full max-w-md rounded-[2.5rem] bg-gradient-to-br from-[#FF9F43] via-[#FF6B8B] to-[#A06CD5] p-10 text-center text-white shadow-tile animate-pop">
            <PartyPopper size={96} className="mx-auto animate-float" />
            <p className="mt-4 text-5xl font-black uppercase">{t('kids.win')}</p>
            <p className="mt-2 text-xl font-bold">{t('kids.moves', { n: moves })}</p>
            <button type="button" onClick={() => start(level)} className="mx-auto mt-8 grid h-24 w-24 place-items-center rounded-full bg-white text-[#A06CD5] shadow-tile active:scale-95" aria-label={t('common.restart')}>
              <RotateCcw size={48} />
            </button>
          </div>
        </div>
      )}
    </Page>
  );
}
