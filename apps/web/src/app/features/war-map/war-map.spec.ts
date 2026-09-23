import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import { initialWarMap, type BattleId, type OpenBattle, type Sector } from '@frontline/core';
import { Subject } from 'rxjs';
import en from '../../../i18n/en.json';
import { WarMap } from './war-map';
import { WarMapSource } from './war-map.source';

const map = initialWarMap();
const target = map.find((sector) => sector.owner === 'lonestar') as Sector;

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

const render = async () => {
  const mapUpdates = new Subject<readonly Sector[] | null>();
  const battleUpdates = new Subject<readonly OpenBattle[]>();
  const demoOffsets = new Subject<number>();
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
      {
        provide: WarMapSource,
        useValue: {
          watchMap: () => mapUpdates,
          watchOpenBattles: () => battleUpdates,
          watchDemoOffset: () => demoOffsets,
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
  return { page, push, fail, skipDemo };
};

describe('the war map', () => {
  it('says it is loading until the first snapshot arrives', async () => {
    const { page } = await render();

    expect(page.textContent).toContain(en.warMap.loading);
  });

  it('draws one hex per sector and how many sectors each faction holds', async () => {
    const { page, push } = await render();

    await push(map);

    expect(page.querySelectorAll('svg[role="img"] g')).toHaveLength(36);
    expect(page.querySelector('dl')?.textContent.replace(/\s+/g, ' ')).toContain(
      'Lonestar 12 Valkyra 12 Manticore 12',
    );
  });

  it('marks the sectors under attack and lists their battles with the score', async () => {
    const { page, push } = await render();

    await push(map, [battle]);

    expect(page.querySelectorAll('.front-pulse')).toHaveLength(1);
    const text = (element: Element | null) => element?.textContent.replace(/\s+/g, ' ').trim();
    const score = [...page.querySelectorAll('ul tr')].map((row) => [
      text(row.querySelector('th')),
      text(row.querySelector('td')),
    ]);
    expect(page.querySelector('ul')?.textContent).toContain(target.name);
    expect(score).toEqual([
      ['Valkyra attacking', '12'],
      ['Lonestar defending', '9'],
    ]);
  });

  it('shows when battles end in real time, even when the demo clock runs ahead', async () => {
    const { page, push, skipDemo } = await render();
    const HOUR_MS = 60 * 60 * 1000;
    const endsAt = (text: string | undefined) => text?.match(/Ends (.*)/)?.[1];

    await push(map, [battle]);
    const before = endsAt(page.querySelector('ul')?.textContent);
    await skipDemo(HOUR_MS);
    await push(map, [{ ...battle, endsAt: new Date(battle.endsAt.getTime() + HOUR_MS) }]);

    expect(endsAt(page.querySelector('ul')?.textContent)).toBe(before);
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
