import { useTranslation } from 'react-i18next';
import { InstagramIcon } from '../components/Icons';
import { QrCode } from '../components/QrCode';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';

export default function Instagram() {
  const { t } = useTranslation();
  const { content } = useApp();
  const url = content?.settings.instagram_url || 'https://www.instagram.com/cutshop_mons/';
  return (
    <Page>
      <PageHeader title={t('instagram.title')} />
      <div className="card grid items-center gap-10 overflow-hidden p-8 md:grid-cols-[auto_1fr] md:p-12 animate-fade-up">
        <QrCode value={url} size={340} className="mx-auto" />
        <div>
          <span className="grid h-20 w-20 place-items-center rounded-3xl bg-gradient-to-br from-[#6B3A5E] via-[#B8573F] to-[#D4A84B]">
            <InstagramIcon size={44} />
          </span>
          <p className="mt-6 text-5xl font-black tracking-wide text-gold">{t('instagram.handle')}</p>
          <p className="mt-4 text-2xl text-cream/85">{t('instagram.text')}</p>
          <p className="mt-6 text-lg font-bold text-gold-300">{t('common.scanMe')}</p>
        </div>
      </div>
    </Page>
  );
}
