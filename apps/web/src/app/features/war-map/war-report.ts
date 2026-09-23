import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ResolvedBattle, SectorId } from '@frontline/core';
import { FactionSwatch } from './faction-swatch';

type Outcome = 'takes' | 'holds' | 'holdsOnTie';

/**
 * The war report: the latest decided battles, newest first, in the plain words of a
 * radio log ("Valkyra takes Iron Ford from Lonestar"). It turns the map's changes into
 * a story anyone can follow between matches.
 */
@Component({
  selector: 'app-war-report',
  imports: [DatePipe, TranslocoPipe, FactionSwatch],
  template: `
    <h2 id="war-report-title" class="font-display font-wide text-3xl font-black sm:text-4xl">
      {{ 'warReport.title' | transloco }}
    </h2>
    @if (battles().length === 0) {
      <p class="mt-4 text-chalk-muted">{{ 'warReport.empty' | transloco }}</p>
    } @else {
      <ol class="mt-6 border-t border-grid">
        @for (battle of battles(); track battle.id) {
          <li
            class="grid grid-cols-[auto_1fr_auto] items-center gap-x-4 border-b border-grid py-3 sm:grid-cols-[4rem_auto_1fr_auto]"
          >
            <time
              [attr.datetime]="realTime(battle.endsAt).toISOString()"
              class="col-span-3 font-data text-sm text-chalk-muted sm:col-span-1"
              >{{ realTime(battle.endsAt) | date: 'HH:mm' }}</time
            >
            <app-faction-swatch [faction]="battle.winner" class="size-4" />
            <p>
              {{
                'warReport.' + outcomeOf(battle)
                  | transloco
                    : {
                        attacker: 'factions.' + battle.attacker | transloco,
                        defender: 'factions.' + battle.defender | transloco,
                        sector: sectorNames().get(battle.sectorId) ?? battle.sectorId,
                      }
              }}
            </p>
            <span class="font-data text-sm font-bold text-chalk-muted tabular-nums"
              >{{ battle.points.attacker }}–{{ battle.points.defender }}</span
            >
          </li>
        }
      </ol>
    }
  `,
  styles: `
    .font-data {
      font-family: var(--font-data);
      font-stretch: 75%;
    }
  `,
})
export class WarReport {
  readonly battles = input.required<readonly ResolvedBattle[]>();
  readonly sectorNames = input.required<ReadonlyMap<SectorId, string>>();
  /** How far war time runs ahead of real time (only in the demo). */
  readonly timeOffsetMs = input(0);

  protected realTime(warTime: Date): Date {
    return new Date(warTime.getTime() - this.timeOffsetMs());
  }

  protected outcomeOf(battle: ResolvedBattle): Outcome {
    if (battle.conquered) return 'takes';
    return battle.points.attacker === battle.points.defender ? 'holdsOnTie' : 'holds';
  }
}
