import { TestBed } from '@angular/core/testing';
import en from '../../../i18n/en.json';
import es from '../../../i18n/es.json';
import { BundledTranslationLoader } from './i18n';

/** Every key of a translation, e.g. `footer.disclaimer`. */
const keysOf = (translation: object, prefix = ''): string[] =>
  Object.entries(translation).flatMap(([key, value]) =>
    typeof value === 'object' && value !== null
      ? keysOf(value as object, `${prefix}${key}.`)
      : [`${prefix}${key}`],
  );

describe('translations', () => {
  it('are bundled with the app for every language', async () => {
    const loader = TestBed.inject(BundledTranslationLoader);

    expect(await loader.getTranslation('en')).toEqual(en);
    expect(await loader.getTranslation('es')).toEqual(es);
  });

  it('reject a language the site does not have', async () => {
    await expect(TestBed.inject(BundledTranslationLoader).getTranslation('xx')).rejects.toThrow();
  });

  it('have the same keys in Spanish as in English', () => {
    expect(keysOf(es).sort()).toEqual(keysOf(en).sort());
  });
});
