import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ArcadeProvider } from './arcade/ArcadeContext';
import ArcadeHome from './arcade/ui/ArcadeHome';
import ChallengeHub from './arcade/ui/ChallengeHub';
import { InviteToast } from './arcade/ui/InviteToast';
import RoomPage from './arcade/ui/RoomPage';
import SoloPlay from './arcade/ui/SoloPlay';
import { BattleInvite } from './components/BattleInvite';
import { TopBar } from './components/TopBar';
import { AppProvider, useApp } from './context/AppContext';
import { BattleProvider } from './context/BattleContext';
import type { ModuleKey } from './lib/types';
import Booking from './pages/Booking';
import Concept from './pages/Concept';
import Drinks from './pages/Drinks';
import EventRegister from './pages/EventRegister';
import Events from './pages/Events';
import Gift from './pages/Gift';
import Home from './pages/Home';
import Social from './pages/Social';
import Category from './pages/Category';
import Invoice from './pages/Invoice';
import Privacy from './pages/Privacy';
import Products from './pages/Products';
import Screensaver from './pages/Screensaver';
import Services from './pages/Services';
import Setup from './pages/Setup';
import Stop10 from './pages/Stop10';
import Wheel from './pages/Wheel';
import BattlePage from './pages/battle/BattlePage';
import KidsHome from './pages/kids/KidsHome';
import LittleBarber from './pages/kids/LittleBarber';
import Memory from './pages/kids/Memory';

// L'espace admin est chargé à la demande : il ne pèse pas sur les tablettes clientes.
const AdminApp = lazy(() => import('./admin/AdminApp'));

/** Une page de module désactivé dans l'admin renvoie à l'accueil. */
function Gate({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { content } = useApp();
  if (content && !content.settings.modules[module]) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Kiosk() {
  const { tablet, sessionKey, asleep, content } = useApp();
  const { pathname } = useLocation();
  const isAdmin = pathname.startsWith('/admin');

  if (!tablet && !isAdmin) return <Setup />;

  return (
    <>
      {!isAdmin && <TopBar />}
      {/* La clé sessionKey démonte tous les écrans à la mise en veille : plus aucune saisie en mémoire. */}
      <div key={sessionKey}>
        {!content && !isAdmin ? (
          <div className="grid min-h-[70vh] place-items-center">
            <span className="h-14 w-14 animate-spin rounded-full border-4 border-gold border-t-transparent" aria-label="..." />
          </div>
        ) : (
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/concept" element={<Gate module="concept"><Concept /></Gate>} />
            <Route path="/services" element={<Gate module="services"><Services /></Gate>} />
            <Route path="/rdv" element={<Gate module="booking"><Booking /></Gate>} />
            <Route path="/evenements" element={<Gate module="events"><Events /></Gate>} />
            <Route path="/evenements/:id" element={<Gate module="events"><EventRegister /></Gate>} />
            <Route path="/battle" element={<Gate module="battle"><BattlePage /></Gate>} />
            <Route path="/arcade" element={<Gate module="arcade"><ArcadeHome /></Gate>} />
            <Route path="/arcade/jouer/:game" element={<Gate module="arcade"><SoloPlay /></Gate>} />
            <Route path="/arcade/challenge" element={<Gate module="arcade"><ChallengeHub /></Gate>} />
            <Route path="/arcade/salle" element={<Gate module="arcade"><RoomPage /></Gate>} />
            <Route path="/stop10" element={<Gate module="stop10"><Stop10 /></Gate>} />
            <Route path="/roue" element={<Gate module="wheel"><Wheel /></Gate>} />
            <Route path="/kids" element={<Gate module="kids"><KidsHome /></Gate>} />
            <Route path="/kids/barbier" element={<Gate module="kids"><LittleBarber /></Gate>} />
            <Route path="/kids/memory" element={<Gate module="kids"><Memory /></Gate>} />
            <Route path="/boissons" element={<Gate module="drinks"><Drinks /></Gate>} />
            <Route path="/produits" element={<Gate module="products"><Products /></Gate>} />
            <Route path="/cheques" element={<Gate module="gift"><Gift /></Gate>} />
            <Route path="/factures" element={<Gate module="invoice"><Invoice /></Gate>} />
            <Route path="/reseaux" element={<Gate module="instagram"><Social /></Gate>} />
            <Route path="/instagram" element={<Navigate to="/reseaux" replace />} />
            <Route path="/jeux" element={<Category category="games" />} />
            <Route path="/boissons-produits" element={<Category category="shop" />} />
            <Route path="/cutshop" element={<Category category="cutshop" />} />
            <Route path="/nos-services" element={<Category category="services" />} />
            <Route path="/confidentialite" element={<Privacy />} />
            <Route
              path="/admin/*"
              element={
                <Suspense fallback={<div className="p-10 text-center text-xl">...</div>}>
                  <AdminApp />
                </Suspense>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        )}
      </div>
      <BattleInvite />
      {!isAdmin && tablet && <InviteToast />}
      {asleep && !isAdmin && <Screensaver />}
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <BattleProvider>
        <ArcadeProvider>
          <Kiosk />
        </ArcadeProvider>
      </BattleProvider>
    </AppProvider>
  );
}
