import { useTranslation } from 'react-i18next';
import { InstagramIcon } from '../components/Icons';
import { FacebookIcon, TikTokIcon } from '../components/Icons.social';
import { QrCode } from '../components/QrCode';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';

/** Nos réseaux : un QR code par réseau, à scanner avec son téléphone. */
export default function Social() {
  const { t } = useTranslation();
  const { content } = useApp();
  const s = content?.settings;
  const networks = [
    { key: 'instagram', name: 'Instagram', handle: '@cutshop_mons', url: s?.instagram_url, icon: InstagramIcon, tone: 'from-[#6B3A5E] via-[#B8573F] to-[#D4A84B]' },
    { key: 'facebook', name: 'Facebook', handle: 'Cutshop Mons', url: s?.facebook_url, icon: FacebookIcon, tone: 'from-[#1D4E89] to-[#2D6CC0]' },
    { key: 'tiktok', name: 'TikTok', handle: '@cutshop_belgium', url: s?.tiktok_url, icon: TikTokIcon, tone: 'from-[#111] via-[#2A2A2A] to-[#1F6F6B]' },
  ].filter((n) => n.url);

  return (
    <Page>
      <PageHeader title={t('social.title')} eyebrow={t('social.sub')} />
      <div className="grid gap-5 md:grid-cols-3" data-testid="social">
        {networks.map((n, i) => {
          const Icon = n.icon;
          return (
            <section key={n.key} className="card flex flex-col items-center p-6 text-center" style={{ animation: `fade-up 0.45s ease-out ${i * 0.06}s both` }} data-testid={`social-${n.key}`}>
              <span className={`grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br text-cream ${n.tone}`}>
                <Icon size={34} />
              </span>
              <h2 className="h2 mt-4">{n.name}</h2>
              <p className="mt-1 text-xl font-black text-gold">{n.handle}</p>
              <QrCode value={n.url!} size={230} className="mt-5" />
            </section>
          );
        })}
      </div>
      <p className="mt-6 text-center text-xl text-cream/85">{t('social.text')}</p>
      <p className="mt-2 text-center text-lg font-bold text-gold-300">{t('common.scanMe')}</p>
    </Page>
  );
}
