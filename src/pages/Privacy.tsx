import { useTranslation } from 'react-i18next';
import { Page, PageHeader } from '../components/ui';
import { useApp } from '../context/AppContext';
import { loc } from '../lib/loc';

export default function Privacy() {
  const { t } = useTranslation();
  const { content, lang } = useApp();
  if (!content) return null;
  return (
    <Page>
      <PageHeader title={t('privacy.title')} back="/" />
      <article className="card max-w-4xl space-y-5 p-8 text-lg leading-relaxed text-cream/90 animate-fade-up">
        {loc(content.settings, 'privacy', lang)
          .split(/\n\s*\n/)
          .map((p, i) => (
            <p key={i}>{p}</p>
          ))}
      </article>
    </Page>
  );
}
