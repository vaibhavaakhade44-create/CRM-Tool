import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";

export const LANGUAGES = [
  { code: "en", label: "English",    native: "English",    flag: "🇬🇧", dir: "ltr" },
  { code: "hi", label: "Hindi",      native: "हिंदी",       flag: "🇮🇳", dir: "ltr" },
  { code: "mr", label: "Marathi",    native: "मराठी",       flag: "🇮🇳", dir: "ltr" },
  { code: "ta", label: "Tamil",      native: "தமிழ்",       flag: "🇮🇳", dir: "ltr" },
  { code: "te", label: "Telugu",     native: "తెలుగు",      flag: "🇮🇳", dir: "ltr" },
  { code: "kn", label: "Kannada",    native: "ಕನ್ನಡ",       flag: "🇮🇳", dir: "ltr" },
  { code: "bn", label: "Bengali",    native: "বাংলা",       flag: "🇮🇳", dir: "ltr" },
  { code: "gu", label: "Gujarati",   native: "ગુજરાતી",    flag: "🇮🇳", dir: "ltr" },
  { code: "pa", label: "Punjabi",    native: "ਪੰਜਾਬੀ",     flag: "🇮🇳", dir: "ltr" },
  { code: "ml", label: "Malayalam",  native: "മലയാളം",     flag: "🇮🇳", dir: "ltr" },
  { code: "or", label: "Odia",       native: "ଓଡ଼ିଆ",       flag: "🇮🇳", dir: "ltr" },
  { code: "ur", label: "Urdu",       native: "اردو",        flag: "🇵🇰", dir: "rtl" },
];

i18n
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    supportedLngs: LANGUAGES.map(l => l.code),
    ns: ["translation"],
    defaultNS: "translation",
    backend: {
      loadPath: "/locales/{{lng}}/{{ns}}.json",
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "businessos_lang",
    },
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });

export default i18n;
