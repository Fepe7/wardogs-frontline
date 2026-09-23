import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoTestingModule } from '@jsverse/transloco';
import {
  initialWarMap,
  type BattleId,
  type OpenBattle,
  type ResolvedBattle,
  type Sector,
} from '@frontline/core';
import { Subject } from 'rxjs';
import en from '../../../i18n/en.json';
import { WarMapSource } from '../war-map/war-map.source';
import { SectorPage } from './sector.page';

const map = initialWarMap();
const ironFord = map.find((sector) => sector.name === 'Iron Ford') as Sector;

const attack: OpenBattle = {
  status: 'open',
  id: 'battle-1' as BattleId,
  sectorId: ironFord.id,
  attacker: 'valkyra',
  defender: ironFord.owner,
  startsAt: new Date('2026-10-01T18:00:00Z'),
  endsAt: new Date('2026-10-01T21:00:00Z'),
  points: { attacker: 6, defender: 4 },
  scoredReportIds: [],
};

const render = async (id: string) => {
  const mapUpdates = new Subject<readonly Sector[] | null>();
  const battleUpdates = new Subject<readonly OpenBattle[]>();
  const historyUpdates = new Subject<readonly ResolvedBattle[]>();
  await TestBed.configureTestingModule({
    imports: [
      SectorPage,
      TranslocoTestingModule.forRoot({
        langs: { en },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
    providers: [
      provideRouter([]),
      {
        provide: WarMapSource,
        useValue: {
          watchMap: () => mapUpdates,
          watchOpenBattles: () => battleUpdates,
          watchDemoOffset: () => new Subject<number>(),
          watchRecentMatches: () => new Subject(),
          watchResolvedBattles: () => new Subject(),
          watchSectorHistory: () => historyUpdates,
        },
      },
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(SectorPage);
  fixture.componentRef.setInput('id', id);
  await fixture.whenStable();
  const page = fixture.nativeElement as HTMLElement;
  const push = async (battles: readonly OpenBattle[], history: readonly ResolvedBattle[] = []) => {
    mapUpdates.next(map);
    battleUpdates.next(battles);
    historyUpdates.next(history);
    await fixture.whenStable();
  };
  return { page, push };
};

describe('a sector page', () => {
  it('names the sector before any live data, so a shared link already says where', async () => {
    const { page } = await render(ironFord.id);

    expect(page.querySelector('h1')?.textContent).toContain('Iron Ford');
  });

  it('says who holds the sector and who is attacking it', async () => {
    const { page, push } = await render(ironFord.id);

    await push([attack]);

    const header = page.querySelector('header')?.textContent.replace(/\s+/g, ' ');
    expect(header).toContain(`Held by ${ironFord.owner.charAt(0).toUpperCase()}`);
    expect(header).toContain('Under attack by Valkyra');
  });

  it('shows only the battle for this sector and marks it on the map', async () => {
    const other: OpenBattle = {
      ...attack,
      id: 'battle-2' as BattleId,
      sectorId: map[20]?.id ?? ironFord.id,
    };
    const { page, push } = await render(ironFord.id);

    await push([attack, other]);

    expect(page.querySelectorAll('app-battle-list li')).toHaveLength(1);
    expect(page.querySelector('svg polygon.stroke-chalk[stroke-width="3"]')).not.toBeNull();
  });

  it('lists the battles already fought here', async () => {
    const decided: ResolvedBattle = {
      ...attack,
      status: 'resolved',
      winner: 'valkyra',
      conquered: true,
    };
    const { page, push } = await render(ironFord.id);

    await push([], [decided]);

    expect(page.textContent).toContain(en.sector.historyTitle);
    expect(page.textContent).toContain('Valkyra takes Iron Ford');
  });

  it('says so for a sector that is not on the map', async () => {
    const { page } = await render('no-such-sector');

    expect(page.querySelector('h1')?.textContent).toContain(en.sector.notFound);
  });
});
