import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import {
  areAdjacent,
  initialWarMap,
  type BattleId,
  type OpenBattle,
  type RecentMatch,
  type ResolvedBattle,
  type Sector,
} from '@frontline/core';
import { Subject } from 'rxjs';
import en from '../../../i18n/en.json';
import { WarMap } from './war-map';
import { WarMapSource } from './war-map.source';
import { WarMapStore } from './war-map.store';

const map = initialWarMap();
// A Lonestar sector on the Valkyra border, so Valkyra can really attack it.
const target = map.find(
  (sector) =>
    sector.owner === 'lonestar' &&
    map.some((other) => other.owner === 'valkyra' && areAdjacent(other.coord, sector.coord)),
) as Sector;

const battle: OpenBattle = {
  status: 'open',
  id: 'battle-1' as BattleId,
  sectorId: target.id,
  attacker: 'valkyra',
  defender: 'lonestar',
  startsAt: new Date('2026-10-01T18:00:00Z'),
  endsAt: new Date('2026-10-01T21:00:00Z'),
  points: { attacker: 12, defender: 9 },
  scoredReportIds: [],
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

const render = async () => {
  const mapUpdates = new Subject<readonly Sector[] | null>();
  const battleUpdates = new Subject<readonly OpenBattle[]>();
  const demoOffsets = new Subject<number>();
  const recentUpdates = new Subject<readonly RecentMatch[]>();
  await TestBed.configureTestingModule({
    imports: [
      WarMap,
      TranslocoTestingModule.forRoot({
        langs: { en },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
    providers: [
      WarMapStore,
      {
        provide: WarMapSource,
        useValue: {
          watchMap: () => mapUpdates,
          watchOpenBattles: () => battleUpdates,
          watchDemoOffset: () => demoOffsets,
          watchRecentMatches: () => recentUpdates,
          watchResolvedBattles: () => new Subject<readonly ResolvedBattle[]>(),
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(WarMap);
  await fixture.whenStable();

  const page = fixture.nativeElement as HTMLElement;
  const push = async (sectors: readonly Sector[] | null, battles: readonly OpenBattle[] = []) => {
    mapUpdates.next(sectors);
    battleUpdates.next(battles);
    await fixture.whenStable();
  };
  const fail = async () => {
    mapUpdates.error(new Error('permission-denied'));
    await fixture.whenStable();
  };
  const skipDemo = async (offsetMs: number) => {
    demoOffsets.next(offsetMs);
    await fixture.whenStable();
  };
  const countMatch = async (match: RecentMatch) => {
    recentUpdates.next([match]);
    await fixture.whenStable();
  };
  return { page, push, fail, skipDemo, countMatch };
};

describe('the war map', () => {
  it('says it is loading until the first snapshot arrives', async () => {
    const { page } = await render();

    expect(page.textContent).toContain(en.warMap.loading);
  });

  it('draws one hex per sector and how many sectors each faction holds', async () => {
    const { page, push } = await render();

    await push(map);

    expect(page.querySelectorAll('svg[role="img"] g.tile')).toHaveLength(36);
    expect(spoken(page.querySelector('dl'))).toBe('Lonestar 12 Valkyra 12 Manticore 12');
  });

  it('marks the sectors under attack and lists their battles with the score', async () => {
    const { page, push } = await render();

    await push(map, [battle]);

    expect(page.querySelectorAll('.front-pulse')).toHaveLength(1);
    const score = [...page.querySelectorAll('ul tr')].map((row) => [
      spoken(row.querySelector('th')),
      spoken(row.querySelector('td')),
    ]);
    expect(page.querySelector('ul')?.textContent).toContain(target.name);
    expect(score).toEqual([
      ['Valkyra attacking', '12'],
      ['Lonestar defending', '9'],
    ]);
  });

  it('counts down the time left on the war clock, which the demo can skip ahead', async () => {
    const { page, push, skipDemo } = await render();
    const HOUR_MS = 60 * 60 * 1000;
    const hoursLeft = () =>
      Number(/(\d+) h/.exec(spoken(page.querySelector('ul li div p:last-child')) ?? '')?.[1]);

    await push(map, [battle]);
    const before = hoursLeft();
    await skipDemo(HOUR_MS);

    expect(before).toBeGreaterThan(0);
    expect(hoursLeft()).toBe(before - 1);
  });

  it('says a battle is closing, not 00:00, once its time is up but it is not resolved yet', async () => {
    const { page, push } = await render();

    await push(map, [{ ...battle, endsAt: new Date('2020-01-01T00:00:00Z') }]);

    expect(spoken(page.querySelector('ul li div p:last-child'))).toBe(en.warMap.closingLabel);
  });

  it('lights up only the battle rows the latest match scored in', async () => {
    const { page, push, countMatch } = await render();
    const latest = (battleIds: string[]): RecentMatch => ({
      matchId: 'match-1',
      placements: { first: 'valkyra', second: 'lonestar', third: 'manticore' },
      playedAt: new Date('2026-10-01T19:00:00Z'),
      battleIds: battleIds as BattleId[],
    });

    await push(map, [battle]);
    await countMatch(latest(['another-battle']));
    expect(page.querySelectorAll('.row-flash')).toHaveLength(0);

    await countMatch(latest([battle.id]));
    expect(page.querySelectorAll('.row-flash')).toHaveLength(1);
  });

  it('says how many matches the points of a battle come from', async () => {
    const { page, push } = await render();

    await push(map, [{ ...battle, scoredReportIds: ['match-1', 'match-2'] }]);

    // In the demo the board also says the matches are simulated.
    expect(page.querySelector('ul')?.textContent).toMatch(/2 (simulated )?matches counted/);
  });

  it('shows who attacks each sector: an arrow in the attacker color and a tooltip', async () => {
    const { page, push } = await render();

    await push(map, [battle]);

    const arrows = page.querySelectorAll('line[marker-end]');
    expect(arrows).toHaveLength(1);
    expect(arrows[0]?.getAttribute('class')).toContain('stroke-valkyra');
    const titles = [...page.querySelectorAll('svg[role="img"] g > title')].map(
      (t) => t.textContent,
    );
    expect(titles).toContain(`Valkyra attacks ${target.name}, held by Lonestar`);
  });

  it('describes the map for screen readers', async () => {
    const { page, push } = await render();

    await push(map, [battle]);

    expect(page.querySelector('svg desc')?.textContent).toBe(
      'Lonestar holds 12 sectors, Valkyra 12 and Manticore 12. Battles in progress: 1.',
    );
  });

  it('explains when the war has not started yet', async () => {
    const { page, push } = await render();

    await push(null);

    expect(page.textContent).toContain(en.warMap.notStarted);
  });

  it('tells the player what to do when the map cannot be loaded', async () => {
    const { page, fail } = await render();

    await fail();

    expect(page.querySelector('[role="alert"]')?.textContent).toContain(en.warMap.error);
  });
});
