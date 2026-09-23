import { isDevMode, Service } from '@angular/core';
import { provideTransloco, type Translation, type TranslocoLoader } from '@jsverse/transloco';

export const LANGUAGES = ['en', 'es'] as const;
export type Language = (typeof LANGUAGES)[number];

const translations: Readonly<Record<Language, () => Promise<{ default: Translation }>>> = {
  en: () => import('../../../i18n/en.json'),
  es: () => import('../../../i18n/es.json'),
};

/**
 * Translations are bundled as lazy chunks instead of fetched over HTTP, so the server
 * render (SSR) gets them without knowing its own public URL.
 */
@Service()
export class BundledTranslationLoader implements TranslocoLoader {
  async getTranslation(lang: string): Promise<Translation> {
    const load = translations[lang as Language] as (typeof translations)[Language] | undefined;
    if (!load) throw new Error(`No translation for "${lang}"`);
    return (await load()).default;
  }
}

/** English is the main language (docs/ARQUITECTURA.md §9). */
export const provideI18n = () =>
  provideTransloco({
    config: {
      availableLangs: [...LANGUAGES],
      defaultLang: 'en',
      fallbackLang: 'en',
      reRenderOnLangChange: true,
      prodMode: !isDevMode(),
    },
    loader: BundledTranslationLoader,
  });
