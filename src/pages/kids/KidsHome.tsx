import { Brain, Scissors } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Page, PageHeader } from '../../components/ui';

export default function KidsHome() {
  const { t } = useTranslation();
  return (
    <Page>
      <PageHeader title={t('kids.title')} back="/jeux" />
      <div className="grid gap-6 md:grid-cols-2">
        <Link
          to="/kids/barbier"
          className="relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#FF9F43] via-[#FF6B8B] to-[#A06CD5] p-8 text-white shadow-tile transition active:scale-[0.97] animate-fade-up"
          data-testid="kids-barber"
        >
          <span className="grid h-40 w-40 place-items-center rounded-full bg-white/25 ring-8 ring-white/20 animate-float">
            <Scissors size={96} strokeWidth={2.2} />
          </span>
          <span className="mt-6 text-4xl font-black uppercase tracking-wide drop-shadow">{t('kids.barber')}</span>
        </Link>
        <Link
          to="/kids/memory"
          className="relative flex min-h-[340px] flex-col items-center justify-center overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-[#2EC4B6] via-[#3A86FF] to-[#6A4CFF] p-8 text-white shadow-tile transition active:scale-[0.97] animate-fade-up"
          data-testid="kids-memory"
        >
          <span className="grid h-40 w-40 place-items-center rounded-full bg-white/25 ring-8 ring-white/20 animate-float [animation-delay:1s]">
            <Brain size={96} strokeWidth={2.2} />
          </span>
          <span className="mt-6 text-4xl font-black uppercase tracking-wide drop-shadow">{t('kids.memory')}</span>
        </Link>
      </div>
    </Page>
  );
}
