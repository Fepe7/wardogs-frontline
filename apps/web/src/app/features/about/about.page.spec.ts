import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { FACTIONS, GAME_CONFIG } from '@frontline/core';
import en from '../../../i18n/en.json';
import { AboutPage, RESULT_MESSAGE_EXAMPLE, SEASON_RESULT_EXAMPLE } from './about.page';

const render = async () => {
  await TestBed.configureTestingModule({
    imports: [
      AboutPage,
      TranslocoTestingModule.forRoot({
        langs: { en },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(AboutPage);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('the about page', () => {
  it('shows the result message it proposes, and it only carries what the war needs', async () => {
    const page = await render();

    const shown = JSON.parse(page.querySelector('pre code')?.textContent ?? '') as unknown;
    expect(shown).toEqual(RESULT_MESSAGE_EXAMPLE);
    expect(Object.keys(RESULT_MESSAGE_EXAMPLE).sort()).toEqual([
      'endedAt',
      'matchId',
      'placements',
    ]);
    expect(new Set(Object.values(RESULT_MESSAGE_EXAMPLE.placements))).toEqual(new Set(FACTIONS));
  });

  it('shows the season result it would send back, with no player data in it', async () => {
    const page = await render();

    const shown = [...page.querySelectorAll('pre code')].map(
      (c) => JSON.parse(c.textContent) as unknown,
    );
    expect(shown).toContainEqual(SEASON_RESULT_EXAMPLE);
    expect(Object.keys(SEASON_RESULT_EXAMPLE).sort()).toEqual([
      'countedMatchIds',
      'endedAt',
      'seasonId',
      'winner',
    ]);
    expect(FACTIONS).toContain(SEASON_RESULT_EXAMPLE.winner);
  });

  it('explains the demo pace with the numbers the game really uses', async () => {
    const page = await render();
    const { demo, standard } = GAME_CONFIG.pace;

    expect(page.textContent).toContain(
      `Here votes last ${String(demo.voteRoundHours)} hour and battles ${String(demo.battleHours)} hours; ` +
        `in a real season they would last ${String(standard.voteRoundHours)} and ${String(standard.battleHours)} hours.`,
    );
  });

  it('says who built it and links to their profile and the source code', async () => {
    const page = await render();
    const author = page.querySelector('#about-author')?.parentElement;

    expect(author?.textContent).toContain('built by Fepe7');
    expect([...(author?.querySelectorAll('a') ?? [])].map((a) => a.getAttribute('href'))).toEqual([
      'https://github.com/Fepe7',
      'https://github.com/Fepe7/wardogs-frontline',
    ]);
  });
});
