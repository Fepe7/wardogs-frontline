import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import { App } from './app';

const DISCLAIMER =
  'Wardogs Frontline is a fan-made community project, not affiliated with or endorsed by Bulkhead or Team17. WARDOGS is a trademark of its respective owners.';

const render = async () => {
  await TestBed.configureTestingModule({
    imports: [
      App,
      TranslocoTestingModule.forRoot({
        langs: { en, es },
        translocoConfig: {
          availableLangs: ['en', 'es'],
          defaultLang: 'en',
          reRenderOnLangChange: true,
        },
        preloadLangs: true,
      }),
    ],
    providers: [provideRouter([])],
  }).compileComponents();
  const fixture = TestBed.createComponent(App);
  await fixture.whenStable();
  return { fixture, page: fixture.nativeElement as HTMLElement };
};

describe('the site shell', () => {
  it('shows the fan-made disclaimer in the footer', async () => {
    const { page } = await render();

    expect(page.querySelector('footer')?.textContent).toContain(DISCLAIMER);
  });

  it('warns that the demo runs on simulated results', async () => {
    const { page } = await render();

    expect(page.querySelector('[role="note"]')?.textContent).toContain(en.demo.notice);
  });

  it('switches the language and tells assistive tech about it', async () => {
    const { fixture, page } = await render();
    const spanish = [...page.querySelectorAll('footer button')].find(
      (button) => button.getAttribute('lang') === 'es',
    ) as HTMLButtonElement;

    spanish.click();
    await fixture.whenStable();

    expect(page.querySelector('footer')?.textContent).toContain(es.footer.disclaimer);
    expect(spanish.getAttribute('aria-pressed')).toBe('true');
    expect(TestBed.inject(DOCUMENT).documentElement.lang).toBe('es');
  });
});
