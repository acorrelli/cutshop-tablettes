import { Tablet } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Logo } from '../components/Logo';
import { useApp } from '../context/AppContext';
import { TABLET_NAMES } from '../lib/tablet';

/** Premier lancement : l'admin attribue un nom à la tablette (stocké localement). */
export default function Setup() {
  const { t } = useTranslation();
  const { setTablet } = useApp();
  return (
    <div className="grid min-h-screen place-items-center p-6">
      <div className="card w-full max-w-3xl p-10 text-center animate-fade-up">
        <div className="mb-6 flex justify-center">
          <Logo size={110} />
        </div>
        <h1 className="h1">{t('setup.title')}</h1>
        <p className="mx-auto mt-4 max-w-xl text-xl text-cream/80">{t('setup.text')}</p>
        <div className="mt-8 grid grid-cols-2 gap-4">
          {TABLET_NAMES.map((name, i) => (
            <button key={name} type="button" className="btn-ghost min-h-[96px] text-2xl" onClick={() => setTablet(name)} data-testid={`setup-${i + 1}`}>
              <Tablet size={32} className="text-gold" /> {t('setup.choose', { n: i + 1 })}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
