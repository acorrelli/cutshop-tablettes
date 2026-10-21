import {
  BarChart3,
  Beer,
  CalendarDays,
  CircleHelp,
  FerrisWheel,
  Gamepad2,
  LayoutGrid,
  LogOut,
  Mail,
  Music,
  MessageCircleHeart,
  Receipt,
  Scissors,
  Settings,
  SprayCan,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import { Logo } from '../components/Logo';
import { useHoldAwake } from '../context/AppContext';
import { api, type AdminSession } from '../lib/api';
import { DEMO_PASSWORD } from '../lib/api/demoApi';
import { IS_DEMO } from '../lib/env';
import { applyUpdate, isUpdateReady, onUpdateReady } from '../lib/appUpdate';
import { isStaffDevice } from '../lib/tablet';
import { ArcadeSection } from './sections/Arcade';
import { BeatTracksSection } from './sections/BeatTracks';
import { DrinksSection, EventsSection, NewsletterSection, ProductsSection, QuizSection, ServicesSection } from './sections/Content';
import { InvoiceRequestsSection, ProductRequestsSection } from './sections/Requests';
import { ModulesSection, SettingsSection } from './sections/Settings';
import { StatsSection } from './sections/Stats';
import { WheelSection } from './sections/Wheel';

// Sur une tablette cliente, l'admin se ferme après 3 minutes sans activité et rend l'écran aux clients.
// Sur le poste de l'équipe (Chromebook), ni veille ni déconnexion automatique.
const TABLET_ADMIN_IDLE_MS = 3 * 60000;

const NAV = [
  { to: 'demandes-produits', label: 'Demandes produits', icon: MessageCircleHeart, el: <ProductRequestsSection /> },
  { to: 'demandes-factures', label: 'Demandes de factures', icon: Receipt, el: <InvoiceRequestsSection /> },
  { to: 'evenements', label: 'Événements', icon: CalendarDays, el: <EventsSection /> },
  { to: 'arcade', label: 'Arcade', icon: Gamepad2, el: <ArcadeSection /> },
  { to: 'musiques', label: 'Musiques Beat Drop', icon: Music, el: <BeatTracksSection /> },
  { to: 'roue', label: 'Roue', icon: FerrisWheel, el: <WheelSection /> },
  { to: 'newsletter', label: 'Newsletter', icon: Mail, el: <NewsletterSection /> },
  { to: 'quiz', label: 'Quiz', icon: CircleHelp, el: <QuizSection /> },
  { to: 'prestations', label: 'Prestations', icon: Scissors, el: <ServicesSection /> },
  { to: 'boissons', label: 'Boissons', icon: Beer, el: <DrinksSection /> },
  { to: 'produits', label: 'Produits', icon: SprayCan, el: <ProductsSection /> },
  { to: 'modules', label: 'Modules', icon: LayoutGrid, el: <ModulesSection /> },
  { to: 'reglages', label: 'Réglages', icon: Settings, el: <SettingsSection /> },
  { to: 'statistiques', label: 'Statistiques', icon: BarChart3, el: <StatsSection /> },
];

function Login({ onDone }: { onDone: (s: AdminSession) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const s = await api.signIn(email.trim(), password);
      if (!s.isAdmin) {
        await api.signOut();
        setError('Ce compte n’a pas les droits administrateur (table admins).');
        return;
      }
      setPassword('');
      onDone(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const input = 'w-full rounded-xl border-2 border-cream/15 bg-bottle-950/60 px-4 py-3 text-lg outline-none focus:border-gold';
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <form className="w-full max-w-md space-y-4 rounded-3xl border border-cream/10 bg-bottle-800/70 p-8 shadow-tile" onSubmit={submit} data-testid="admin-login">
        <div className="flex items-center gap-4">
          <Logo size={64} />
          <div className="mr-auto">
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-gold">Cutshop</p>
            <h1 className="text-2xl font-black uppercase">Espace admin</h1>
          </div>
          {!isStaffDevice() && (
            <button type="button" className="grid h-12 w-12 place-items-center rounded-xl bg-white/10" onClick={() => navigate('/')} aria-label="Fermer">
              <X />
            </button>
          )}
        </div>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Adresse mail</span>
          <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required name="email" />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-bold">Mot de passe</span>
          <input className={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required name="password" />
        </label>
        {IS_DEMO && <p className="rounded-xl bg-gold/15 p-3 text-sm text-gold-300">Mode démonstration : n’importe quelle adresse, mot de passe « {DEMO_PASSWORD} ».</p>}
        {error && <p className="rounded-xl bg-red-900/50 p-3 text-sm font-bold">{error}</p>}
        <button type="submit" disabled={busy} className="min-h-[56px] w-full rounded-xl bg-gold text-lg font-black text-bottle-950 disabled:opacity-50" data-testid="admin-login-submit">
          Se connecter
        </button>
      </form>
    </div>
  );
}

export default function AdminApp() {
  const navigate = useNavigate();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checked, setChecked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [updateReady, setUpdateReady] = useState(isUpdateReady);
  useEffect(() => onUpdateReady(setUpdateReady), []);
  // La veille des tablettes est suspendue dans l'admin, qui a sa propre déconnexion automatique.
  useHoldAwake(true);
  // L'écran reste allumé tant que l'admin est ouvert (Chromebook : pas de mise en veille de l'écran).
  useEffect(() => {
    type WakeLock = { release: () => Promise<void> };
    const nav = navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<WakeLock> } };
    if (!nav.wakeLock) return;
    let lock: WakeLock | null = null;
    let alive = true;
    const request = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen').then(
        (l) => {
          if (alive) lock = l;
          else void l.release().catch(() => undefined);
        },
        () => undefined,
      );
    };
    request();
    // Le verrou tombe quand la fenêtre est cachée : on le reprend au retour.
    document.addEventListener('visibilitychange', request);
    return () => {
      alive = false;
      document.removeEventListener('visibilitychange', request);
      void lock?.release().catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    void api.getSession().then((s) => {
      setSession(s?.isAdmin ? s : null);
      setChecked(true);
    });
  }, []);

  const logout = useCallback(async () => {
    await api.signOut();
    setSession(null);
    if (!isStaffDevice()) navigate('/');
  }, [navigate]);

  useEffect(() => {
    if (!session || isStaffDevice()) return;
    const arm = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void logout(), TABLET_ADMIN_IDLE_MS);
    };
    arm();
    const evs = ['pointerdown', 'keydown'] as const;
    evs.forEach((e) => window.addEventListener(e, arm));
    return () => {
      if (timer.current) clearTimeout(timer.current);
      evs.forEach((e) => window.removeEventListener(e, arm));
    };
  }, [session, logout]);

  if (!checked) return null;
  if (!session) return <Login onDone={setSession} />;

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-cream/10 bg-bottle-950/80 p-4 lg:sticky lg:top-0 lg:h-screen lg:w-72 lg:shrink-0 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <div className="mb-4 flex items-center gap-3">
          <Logo size={48} />
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-gold">Admin Cutshop</p>
            <p className="truncate text-sm text-cream/60">{session.email}</p>
          </div>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={`/admin/${to}`}
              className={({ isActive }) => `flex min-h-[48px] shrink-0 items-center gap-3 rounded-xl px-4 font-bold transition ${isActive ? 'bg-gold text-bottle-950' : 'hover:bg-white/10'}`}
              data-testid={`nav-${to}`}
            >
              <Icon size={20} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-4 flex gap-2 lg:flex-col">
          {!isStaffDevice() && (
            <button type="button" className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-white/10 font-bold" onClick={() => navigate('/')}>
              Retour tablette
            </button>
          )}
          <button type="button" className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-red-900/60 font-bold" onClick={logout} data-testid="admin-logout">
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 p-4 lg:p-8">
        {updateReady && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-gold/15 p-3" data-testid="app-update">
            <p className="flex-1 font-bold text-gold-300">Une nouvelle version de l’application est disponible. Les tablettes l’installent toutes seules à leur prochaine mise en veille.</p>
            <button type="button" className="min-h-[48px] rounded-xl bg-gold px-4 font-black text-bottle-950" onClick={applyUpdate}>
              Mettre à jour ce poste
            </button>
          </div>
        )}
        {IS_DEMO && <p className="mb-4 rounded-xl bg-gold/15 p-3 text-sm font-bold text-gold-300">Mode démonstration : Supabase n’est pas configuré, les données restent dans ce navigateur.</p>}
        <Routes>
          <Route index element={<Navigate to="/admin/demandes-produits" replace />} />
          {NAV.map((n) => (
            <Route key={n.to} path={n.to} element={n.el} />
          ))}
          <Route path="*" element={<Navigate to="/admin/demandes-produits" replace />} />
        </Routes>
      </main>
    </div>
  );
}
