import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';

/**
 * VastuVerse i18n.
 *
 *  Languages: en, hi, bn, ta, te, mr, gu, kn
 *  Backend  : /locales/{lng}/translation.json (served from /public)
 *  Detection: localStorage → navigator → fallback 'en'
 *
 * Use:
 *   import { useTranslation } from 'react-i18next';
 *   const { t } = useTranslation();
 *   <Typography>{t('wizard.step1.title')}</Typography>
 *
 * Programmatic switch:
 *   import i18n from '@/i18n/i18n';
 *   i18n.changeLanguage('hi');
 *
 * The currency formatter below is bundled here so import sites get a
 * locale-aware formatter without pulling another util in.
 */

export const LANGUAGES = [
  { code: 'en', flag: '🇬🇧', label: 'English',   nativeName: 'English' },
  { code: 'hi', flag: '🇮🇳', label: 'Hindi',     nativeName: 'हिन्दी' },
  { code: 'bn', flag: '🇧🇩', label: 'Bengali',   nativeName: 'বাংলা' },
  { code: 'ta', flag: '🇮🇳', label: 'Tamil',     nativeName: 'தமிழ்' },
  { code: 'te', flag: '🇮🇳', label: 'Telugu',    nativeName: 'తెలుగు' },
  { code: 'mr', flag: '🇮🇳', label: 'Marathi',   nativeName: 'मराठी' },
  { code: 'gu', flag: '🇮🇳', label: 'Gujarati',  nativeName: 'ગુજરાતી' },
  { code: 'kn', flag: '🇮🇳', label: 'Kannada',   nativeName: 'ಕನ್ನಡ' },
];

export const SUPPORTED_LNGS = LANGUAGES.map((l) => l.code);

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LNGS,
    nonExplicitSupportedLngs: true,   // 'en-US' counts as 'en'
    load: 'languageOnly',             // ignore region codes

    backend: {
      // Vite serves /public at the root; loadPath is resolved by HttpBackend
      loadPath: '/locales/{{lng}}/translation.json',
    },

    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
      lookupLocalStorage: 'i18nextLng',
    },

    interpolation: {
      escapeValue: false, // React already escapes
      format: (value, format) => {
        if (format === 'inr')  return formatInr(value);
        if (format === 'date') return formatDate(value);
        if (format === 'time') return formatTime(value);
        return value;
      },
    },

    react: { useSuspense: false },
  });

/* ─── Currency + date formatters (Intl, locale-aware) ─────────────── */

/**
 * Format paise (₹ * 100) into Indian-grouped INR string.
 *   formatInr(125000000) → "₹12,50,000" (12 lakh 50 thousand)
 */
export function formatInr(paise) {
  if (paise === undefined || paise === null || Number.isNaN(Number(paise))) return '—';
  const rupees = Math.round(Number(paise) / 100);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(rupees);
}

/** Format ₹ from rupees directly (not paise). */
export function formatRupees(rupees) {
  if (rupees === undefined || rupees === null || Number.isNaN(Number(rupees))) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(rupees));
}

export function formatDate(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(i18n.language || 'en-IN', {
    year: 'numeric', month: 'short', day: 'numeric',
  }).format(d);
}

export function formatTime(date) {
  if (!date) return '';
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(i18n.language || 'en-IN', {
    hour: '2-digit', minute: '2-digit',
  }).format(d);
}

export default i18n;
