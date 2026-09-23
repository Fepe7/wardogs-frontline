import { Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { OpenBattle, RecentMatch, SectorId } from '@frontline/core';
import { FactionSwatch } from './faction-swatch';
import { FlapText } from './flap-text';

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
/** Points and hours are shown on two tiles. */
const TWO_TILES = 2;

const twoDigits = (value: number): string => String(value).padStart(TWO_TILES, '0');

/** Time left in a battle, whole hours and minutes, never below zero. */
export const timeLeft = (endsAt: Date, warNowMs: number) => {
  const left = Math.max(0, endsAt.getTime() - warNowMs);
  return { hours: Math.floor(left / HOUR_MS), minutes: Math.floor((left % HOUR_MS) / MINUTE_MS) };
};

/**
 * The dispatch board: one row per battle in progress, with the sector on flap tiles,
 * both sides and their points, the time left and how many matches the points come from.
 * Changed points and times flip, and the rows the latest match scored in light up.
 */
@Component({
  selector: 'app-battle-list',
  imports: [RouterLink, TranslocoPipe, FactionSwatch, FlapText],
  template: `
    <h3 class="font-display text-lg font-extrabold text-chalk-muted">
      {{ 'warMap.battlesTitle' | transloco }}
    </h3>
    @if (battles().length === 0) {
      <p class="mt-3 text-chalk-muted">{{ 'warMap.noBattles' | transloco }}</p>
    } @else {
      <ul class="mt-2">
        @for (battle of battles(); track battle.id) {
          @let left = timeLeft(battle.endsAt, warNowMs());
          <li class="relative border-t border-grid py-3">
            <!-- One element per latest match that scored here: the row lights up amber, once. -->
            @if (flashKey(battle); as key) {
              @for (flash of [key]; track flash) {
                <span
                  aria-hidden="true"
                  class="row-flash pointer-events-none absolute inset-0"
                ></span>
              }
            }
            <a
              [routerLink]="['/sector', battle.sectorId]"
              class="sector-link relative inline-flex text-[1.2rem] text-chalk"
            >
              <app-flap-text [text]="sectorNames().get(battle.sectorId) ?? battle.sectorId" />
            </a>
            <div class="relative mt-2 flex items-center justify-between gap-4">
              <p class="text-xs text-chalk-muted">
                {{
                  (simulated() ? 'warMap.simulatedMatchesCounted' : 'warMap.matchesCounted')
                    | transloco: { count: battle.scoredReportIds.length }
                }}
              </p>
              <p class="flex items-center gap-2 text-xs font-semibold text-chalk-muted uppercase">
                <!-- Time up but not yet resolved (the war advances on a schedule): never show 00:00. -->
                @if (left.hours === 0 && left.minutes === 0) {
                  <app-flap-text
                    class="text-sm text-signal"
                    [text]="'warMap.closing' | transloco"
                    [label]="'warMap.closingLabel' | transloco"
                  />
                } @else {
                  <span aria-hidden="true">{{ 'warMap.left' | transloco }}</span>
                  <app-flap-text
                    class="text-sm text-signal"
                    [text]="format(left.hours) + ':' + format(left.minutes)"
                    [label]="'warMap.timeLeft' | transloco: left"
                  />
                }
              </p>
            </div>
            <table class="relative mt-2 w-full">
              <caption class="sr-only">
                {{
                  'warMap.score' | transloco
                }}
              </caption>
              <tbody>
                @for (side of sides(battle); track side.role) {
                  <tr>
                    <th scope="row" class="py-0.5 text-left font-normal">
                      <span class="flex items-center gap-2">
                        <app-faction-swatch [faction]="side.faction" class="size-4" />
                        <span class="font-semibold">{{
                          'factions.' + side.faction | transloco
                        }}</span>
                        <!-- The leading space keeps "Valkyra attacking" two words for screen readers. -->
                        <span class="text-sm text-chalk-muted">{{
                          ' ' + ('warMap.' + side.role | transloco)
                        }}</span>
                      </span>
                    </th>
                    <td class="py-0.5 text-right">
                      <app-flap-text
                        class="text-base"
                        [text]="format(side.points)"
                        [label]="'' + side.points"
                      />
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    .sector-link {
      text-decoration: underline 2px transparent;
      text-underline-offset: 6px;
      transition: text-decoration-color 120ms ease;
    }
    .sector-link:focus-visible,
    .sector-link:hover {
      text-decoration-color: var(--color-signal);
    }
    .row-flash {
      background: color-mix(in oklab, var(--color-signal) 16%, transparent);
      opacity: 0;
      animation: row-flash 1.4s var(--ease-out);
    }
    @keyframes row-flash {
      from {
        opacity: 1;
      }
    }
  `,
})
export class BattleList {
  readonly battles = input.required<readonly OpenBattle[]>();
  readonly sectorNames = input.required<ReadonlyMap<SectorId, string>>();
  /** Current time on the war's clock (ahead of real time in the demo). */
  readonly warNowMs = input.required<number>();
  /** Demo: the points come from simulated matches, and the board says so. */
  readonly simulated = input(false);
  /** The latest counted match: the rows it scored in light up. */
  readonly latestMatch = input<RecentMatch | null>(null);

  protected readonly timeLeft = timeLeft;
  protected readonly format = twoDigits;

  protected flashKey(battle: OpenBattle): string | null {
    const latest = this.latestMatch();
    return latest?.battleIds.includes(battle.id) ? latest.matchId : null;
  }

  protected sides(battle: OpenBattle) {
    return [
      { role: 'attacker', faction: battle.attacker, points: battle.points.attacker },
      { role: 'defender', faction: battle.defender, points: battle.points.defender },
    ] as const;
  }
}
