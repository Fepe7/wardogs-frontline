import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { GAME_CONFIG } from '@frontline/core';
import en from '../../../i18n/en.json';
import { HomePage } from './home.page';

describe('the home page', () => {
  it('explains the scoring with the points the game really uses', async () => {
    await TestBed.configureTestingModule({
      imports: [
        HomePage,
        TranslocoTestingModule.forRoot({
          langs: { en },
          translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
          preloadLangs: true,
        }),
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(HomePage);
    await fixture.whenStable();

    const { first, second, third } = GAME_CONFIG.pointsByPlacement;
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      `${String(first)} for first place, ${String(second)} for second and ${String(third)} for third`,
    );
  });
});
