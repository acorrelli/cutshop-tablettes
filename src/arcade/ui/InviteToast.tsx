// Invitation discrète d'une autre table, visible partout sauf pendant une partie (elle attend la fin),
// et rappel de la partie en attente quand le joueur s'éloigne du salon.
import { Check, Swords, X } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { useArcade } from '../ArcadeContext';
import { GAME_ART } from '../assets';
import { GAMES } from '../registry';
import { TableBadge, useErrorText, usePseudoGate, useTicker, variantLabel } from './common';

/** Écrans où une invitation ne doit pas s'afficher (autres jeux en cours, admin). */
const QUIET = ['/admin', '/battle', '/stop10', '/kids', '/roue'];

export function InviteToast() {
  const { t } = useTranslation();
  const { lang, asleep, content } = useApp();
  const { snapshot, playing, act } = useArcade();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const errorText = useErrorText();
  const gate = usePseudoGate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const invite = snapshot?.invites[0];
  const room = snapshot?.room;
  const now = useTicker(500, Boolean(invite));
  const offset = snapshot ? snapshot.now - Date.now() : 0;

  if (asleep || playing || content?.settings.modules.arcade === false || QUIET.some((q) => pathname.startsWith(q))) return gate.dialog;

  const respond = (accept: boolean) => {
    if (!invite) return;
    const go = async (pseudo: string) => {
      setBusy(true);
      setError(null);
      const r = await act((s) => s.respond(invite.room_id, accept, pseudo));
      setBusy(false);
      if (!r.ok) setError(errorText(r.code));
      else if (accept) navigate('/arcade/salle');
    };
    if (accept) gate.require((p) => void go(p));
    else void go('');
  };

  if (invite) {
    const left = Math.max(0, Math.ceil((invite.expires_at - (now + offset)) / 1000));
    return (
      <>
        <div className="fixed bottom-4 right-4 z-40 w-[min(30rem,calc(100vw-2rem))] animate-fade-up" data-testid="arcade-invite" role="alert">
          <div className="flex gap-3 rounded-3xl border-2 border-[#7CE3A0]/70 bg-[#0B1511]/95 p-3 shadow-tile backdrop-blur">
            <img src={GAME_ART[invite.game].card} alt="" className="h-24 w-20 shrink-0 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-sm font-black uppercase tracking-widest text-[#9BE7B5]">
                <Swords size={16} /> {invite.mode === 'duel' ? t('arcade.invite.duel') : t('arcade.invite.battle')}
              </p>
              <p className="mt-0.5 flex items-center gap-2 text-lg font-black leading-tight text-cream">
                <TableBadge table={invite.host} size="sm" />
                <span className="truncate">{t('arcade.invite.from', { pseudo: invite.host_pseudo })}</span>
              </p>
              <p className="truncate text-base text-cream/75">
                {GAMES[invite.game].title}
                {GAMES[invite.game].variants.length > 1 && ` · ${variantLabel(invite.game, invite.variant, lang)}`} · {left} s
              </p>
              {error && <p className="text-sm font-bold text-red-300">{error}</p>}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button type="button" className="btn min-h-[48px] bg-[#7CE3A0] text-base text-bottle-950" disabled={busy} onClick={() => respond(true)} data-testid="invite-accept">
                  <Check size={20} /> {t('arcade.invite.accept')}
                </button>
                <button type="button" className="btn-ghost min-h-[48px] text-base" disabled={busy} onClick={() => respond(false)} data-testid="invite-decline">
                  <X size={20} /> {t('arcade.invite.decline')}
                </button>
              </div>
            </div>
          </div>
        </div>
        {gate.dialog}
      </>
    );
  }

  if (room && (room.status === 'lobby' || room.status === 'playing') && !pathname.startsWith('/arcade/salle')) {
    return (
      <button
        type="button"
        onClick={() => navigate('/arcade/salle')}
        className="fixed bottom-4 right-4 z-40 flex items-center gap-3 rounded-full border-2 border-gold bg-[#0B1511]/95 py-2 pl-2 pr-5 text-lg font-black text-cream shadow-tile animate-fade-up"
        data-testid="arcade-room-pill"
      >
        <span className="grid h-11 w-11 place-items-center rounded-full bg-gold text-bottle-950">
          <Swords size={22} />
        </span>
        {room.status === 'playing' ? t('arcade.invite.backPlaying') : t('arcade.invite.backLobby')}
      </button>
    );
  }
  return gate.dialog;
}
