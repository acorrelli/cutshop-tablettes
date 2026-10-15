import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { frenchTypo } from '../lib/typo';
import en from './en.json';
import fr from './fr.json';

// Le français est la langue par défaut ; chaque client peut basculer en anglais.
// La langue n'est pas mémorisée : elle revient au français à chaque mise en veille.
void i18n
  .use({
    type: 'postProcessor',
    name: 'frenchTypo',
    process: (value: string, _key: string | string[], _options: unknown, translator: { language?: string }) =>
      translator?.language === 'fr' ? frenchTypo(value) : value,
  })
  .use(initReactI18next)
  .init({
    resources: { fr: { translation: fr }, en: { translation: en } },
    lng: 'fr',
    fallbackLng: 'fr',
    interpolation: { escapeValue: false },
    returnNull: false,
    postProcess: ['frenchTypo'],
  });

export default i18n;
