import { TestBed } from '@angular/core/testing';
import { TranslocoTestingModule } from '@jsverse/transloco';
import type { BattleId, ResolvedBattle, SectorId } from '@frontline/core';
import en from '../../../i18n/en.json';
import { WarReport } from './war-report';

const decided = (overrides: Partial<ResolvedBattle>): ResolvedBattle => ({
  status: 'resolved',
  id: 'battle-1' as BattleId,
  sectorId: 'iron-ford' as SectorId,
  attacker: 'valkyra',
  defender: 'lonestar',
  startsAt: new Date('2026-10-01T18:00:00Z'),
  endsAt: new Date('2026-10-01T21:00:00Z'),
  points: { attacker: 21, defender: 14 },
  scoredReportIds: [],
  winner: 'valkyra',
  conquered: true,
  ...overrides,
});

const render = async (battles: readonly ResolvedBattle[]) => {
  await TestBed.configureTestingModule({
    imports: [
      WarReport,
      TranslocoTestingModule.forRoot({
        langs: { en },
        translocoConfig: { availableLangs: ['en'], defaultLang: 'en' },
        preloadLangs: true,
      }),
    ],
  }).compileComponents();
  const fixture = TestBed.createComponent(WarReport);
  fixture.componentRef.setInput('battles', battles);
  fixture.componentRef.setInput('sectorNames', new Map([['iron-ford' as SectorId, 'Iron Ford']]));
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

const lines = (page: HTMLElement) =>
  [...page.querySelectorAll('li p')].map((p) => p.textContent.replace(/\s+/g, ' ').trim());

describe('the war report', () => {
  it('reports a conquest as the attacker taking the sector, with the score', async () => {
    const page = await render([decided({})]);

    expect(lines(page)).toEqual(['Valkyra takes Iron Ford from Lonestar']);
    expect(page.querySelector('li')?.textContent).toContain('21–14');
  });

  it('reports a failed attack as the defender holding the sector', async () => {
    const page = await render([
      decided({ winner: 'lonestar', conquered: false, points: { attacker: 9, defender: 17 } }),
    ]);

    expect(lines(page)).toEqual(['Lonestar holds Iron Ford against Valkyra']);
  });

  it('explains a tie, since ties go to the defender', async () => {
    const page = await render([
      decided({ winner: 'lonestar', conquered: false, points: { attacker: 12, defender: 12 } }),
    ]);

    expect(lines(page)).toEqual([
      'Lonestar holds Iron Ford against Valkyra: a tie goes to the defender',
    ]);
  });

  it('says so while no battle has been decided yet', async () => {
    const page = await render([]);

    expect(page.textContent).toContain(en.warReport.empty);
  });
});
