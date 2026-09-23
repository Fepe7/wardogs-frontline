import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { TranslocoService, TranslocoTestingModule } from '@jsverse/transloco';
import en from '../../../i18n/en.json';
import es from '../../../i18n/es.json';
import { routes } from '../../app.routes';
import { Seo } from './seo';

const setup = async () => {
  TestBed.configureTestingModule({
    imports: [
      TranslocoTestingModule.forRoot({
        langs: { en, es },
        translocoConfig: { availableLangs: ['en', 'es'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
    providers: [provideRouter(routes, withComponentInputBinding())],
  });
  TestBed.inject(Seo).start();
  const harness = await RouterTestingHarness.create();
  const document = TestBed.inject(DOCUMENT);
  const tag = (selector: string) =>
    document.head.querySelector(`meta[${selector}]`)?.getAttribute('content');
  return { harness, document, tag };
};

describe('page titles and link previews', () => {
  it('describe each page for search engines and chat apps', async () => {
    const { harness, document, tag } = await setup();

    await harness.navigateByUrl('/about');

    expect(document.title).toBe(en.meta.about.title);
    expect(tag('name="description"')).toBe(en.meta.about.description);
    expect(tag('property="og:title"')).toBe(en.meta.about.title);
    expect(tag('property="og:description"')).toBe(en.meta.about.description);
    expect(tag('property="og:image"')).toContain('og-image.png');
  });

  it('follow the language the visitor picks', async () => {
    const { harness, document } = await setup();
    await harness.navigateByUrl('/');

    TestBed.inject(TranslocoService).setActiveLang('es');
    await harness.fixture.whenStable();

    expect(document.title).toBe(es.meta.home.title);
  });

  it('name the sector on its own page, so a shared link says where the fight is', async () => {
    const { harness, document, tag } = await setup();

    await harness.navigateByUrl('/sector/iron-ford');

    expect(document.title).toBe('Iron Ford | Wardogs Frontline');
    expect(tag('property="og:description"')).toContain('Iron Ford');
  });

  it('show a page of their own for unknown addresses', async () => {
    const { harness, document } = await setup();

    await harness.navigateByUrl('/no-such-sector');

    expect(document.title).toBe(en.meta.notFound.title);
    expect(harness.routeNativeElement?.textContent).toContain(en.notFound.title);
  });
});
