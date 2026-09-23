import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import type { FastForwardDemoResponse } from '@frontline/contracts';
import en from '../../../i18n/en.json';
import { DemoControls } from './demo-controls';
import { FastForwardButton } from './fast-forward-button';

const render = async (fastForward: () => Promise<FastForwardDemoResponse>) => {
  await TestBed.configureTestingModule({
    imports: [
      FastForwardButton,
      TranslocoTestingModule.forRoot({
        langs: { en },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
    providers: [{ provide: DemoControls, useValue: { fastForward } }],
  }).compileComponents();
  const fixture = TestBed.createComponent(FastForwardButton);
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  const button = page.querySelector('button') as HTMLButtonElement;
  const status = () => page.querySelector('[role="status"]')?.textContent.trim();
  return { fixture, button, status };
};

describe('the fast-forward button', () => {
  it('skips an hour and says what happened in the war', async () => {
    const { fixture, button, status } = await render(() =>
      Promise.resolve({ resolvedBattles: 1, closedRounds: 3, matches: 6 }),
    );

    button.click();
    await fixture.whenStable();

    expect(status()).toBe('One hour later: 6 matches played, 3 votes closed and 1 battles over.');
  });

  it('cannot be pressed again while the hour is being skipped', async () => {
    let finish: (summary: FastForwardDemoResponse) => void = () => undefined;
    const { fixture, button } = await render(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );

    button.click();
    fixture.detectChanges();

    expect(button.disabled).toBe(true);
    expect(button.textContent.trim()).toBe(en.demo.fastForwarding);
    finish({ resolvedBattles: 0, closedRounds: 0, matches: 6 });
    await Promise.resolve(); // let the click handler resume after the call
    await fixture.whenStable();
    expect(button.disabled).toBe(false);
  });

  it('explains when the demo has been skipped ahead too often', async () => {
    const { fixture, button, status } = await render(() =>
      Promise.reject(Object.assign(new Error('limit'), { details: { reason: 'rate-limited' } })),
    );

    button.click();
    await fixture.whenStable();

    expect(status()).toBe(en.demo['rate-limited']);
  });

  it('asks to try again on any other failure', async () => {
    const { fixture, button, status } = await render(() => Promise.reject(new Error('offline')));

    button.click();
    await fixture.whenStable();

    expect(status()).toBe(en.demo.failed);
  });
});
