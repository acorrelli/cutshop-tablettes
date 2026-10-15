import { Swords, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { useBattle, useBattleEngine } from '../context/BattleContext';
import { useEffect, useState } from 'react';

/** Invitation affichée sur toutes les pages quand une Battle s'ouvre sur une autre tablette. */
export function BattleInvite() {
  const { t } = useTranslation();
  const s = useBattle();
  const engine = useBattleEngine();
  const { asleep, content } = useApp();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const invite = s?.invite;
  useEffect(() => {
    if (!invite) return;
    const id = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(id);
  }, [invite]);

  if (!invite || !engine || asleep || content?.settings.modules.battle === false) return null;
  if (pathname.startsWith('/battle') || pathname.startsWith('/admin')) return null;
  const left = Math.max(0, Math.ceil((invite.lobbyEndsAt - now) / 1000));

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 p-4 animate-fade-up" data-testid="battle-invite-banner">
      <div className="mx-auto flex max-w-4xl items-center gap-4 rounded-3xl border-2 border-gold bg-bottle-900/95 p-4 shadow-tile backdrop-blur">
        <span className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gold text-bottle-950 animate-pulse-soft">
          <Swords size={34} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xl font-black uppercase text-gold">{t('battle.invite')}</p>
          <p className="truncate text-base text-cream/80">
            {t('battle.inviteBy', { pseudo: invite.hostPseudo, tablet: invite.hostTablet })} · {left} s
          </p>
        </div>
        <button type="button" className="btn-gold text-xl" onClick={() => navigate('/battle')} data-testid="invite-join">
          {t('battle.join')}
        </button>
        <button type="button" className="btn-ghost w-[56px] px-0" onClick={() => engine.dismissInvite()} aria-label={t('common.close')}>
          <X size={26} />
        </button>
      </div>
    </div>
  );
}
