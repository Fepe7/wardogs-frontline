import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { GAME_CONFIG, type BattleId, type RecentMatch } from '@frontline/core';
import en from '../../../i18n/en.json';
import { LastMatch } from './last-match';

const match: RecentMatch = {
  matchId: 'match-1',
  placements: { first: 'manticore', second: 'valkyra', third: 'lonestar' },
  playedAt: new Date('2026-10-01T19:40:00Z'),
  battleIds: ['battle-1' as BattleId],
};

const render = async (latest: RecentMatch | null) => {
  await TestBed.configureTestingModule({
    imports: [
      LastMatch,
      TranslocoTestingModule.forRoot({
        langs: { en },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(LastMatch);
  fixture.componentRef.setInput('match', latest);
  fixture.componentRef.setInput('simulated', true);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

/** Text as screen readers get it: the flap tiles are decorative, their label is not. */
const spoken = (element: Element | null | undefined): string | undefined => {
  if (!element) return undefined;
  const copy = element.cloneNode(true) as Element;
  copy.querySelectorAll('[aria-hidden="true"]').forEach((hidden) => {
    hidden.remove();
  });
  return copy.textContent.replace(/\s+/g, ' ').trim();
};

describe('the last counted match', () => {
  it('shows each faction with its placement and the points the game gives for it', async () => {
    const page = await render(match);

    const { first, second, third } = GAME_CONFIG.pointsByPlacement;
    expect([...page.querySelectorAll('li')].map((row) => spoken(row))).toEqual([
      `1st place Manticore +${String(first)} points`,
      `2nd place Valkyra +${String(second)} points`,
      `3rd place Lonestar +${String(third)} points`,
    ]);
  });

  it('says the match was simulated in the demo', async () => {
    const page = await render(match);

    expect(page.querySelector('h2')?.textContent).toContain('Last simulated match');
  });

  it('shows nothing until the war has counted a match', async () => {
    const page = await render(null);

    expect(page.querySelector('section')).toBeNull();
  });
});
