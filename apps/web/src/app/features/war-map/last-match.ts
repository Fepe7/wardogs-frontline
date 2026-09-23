import { DatePipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { GAME_CONFIG, type Placement, type RecentMatch } from '@frontline/core';
import { FactionSwatch } from './faction-swatch';
import { FlapText } from './flap-text';

const PLACEMENTS: readonly Placement[] = ['first', 'second', 'third'];

/**
 * The latest match the war counted, as a dispatch: each faction's placement and the
 * points it earned. Tracked by match, so every new match lands on the board with its
 * tiles flipping in; on load it replays the latest one.
 */
@Component({
  selector: 'app-last-match',
  imports: [DatePipe, TranslocoPipe, FactionSwatch, FlapText],
  template: `
    @if (match(); as latest) {
      @for (shown of [latest]; track shown.matchId) {
        <section aria-live="polite" aria-labelledby="last-match-title" class="dispatch">
          <h2 id="last-match-title" class="font-display text-base font-extrabold text-chalk-muted">
            {{
              (simulated() ? 'warMap.lastMatchSimulated' : 'warMap.lastMatch')
                | transloco: { time: (realTime(shown.playedAt) | date: 'HH:mm') }
            }}
          </h2>
          <ol class="mt-2 space-y-1.5">
            @for (row of rows(shown); track row.placement) {
              <li class="flex items-center gap-3">
                <app-flap-text
                  class="text-sm text-chalk"
                  [text]="row.rank"
                  [label]="'warMap.places.' + row.placement | transloco"
                />
                <app-faction-swatch [faction]="row.faction" class="size-4" />
                <span class="font-display text-xl leading-none font-black">
                  {{ 'factions.' + row.faction | transloco }}
                </span>
                <!-- The plus sits outside the tile: the hinge gap would cut its bar. -->
                <span class="ms-auto flex items-center gap-1 font-bold text-signal">
                  <span aria-hidden="true">+</span>
                  <app-flap-text
                    class="text-sm"
                    [text]="'' + row.points"
                    [label]="'warMap.pointsEarned' | transloco: { points: row.points }"
                  />
                </span>
              </li>
            }
          </ol>
        </section>
      }
    }
  `,
  styles: `
    .dispatch {
      animation: dispatch-in 420ms var(--ease-out) both;
    }
    @keyframes dispatch-in {
      from {
        opacity: 0;
        transform: translateY(6px);
      }
    }
  `,
})
export class LastMatch {
  readonly match = input.required<RecentMatch | null>();
  /** Demo: the match was simulated, and the board says so. */
  readonly simulated = input(false);
  /** How far war time runs ahead of real time (only in the demo). */
  readonly timeOffsetMs = input(0);

  protected realTime(warTime: Date): Date {
    return new Date(warTime.getTime() - this.timeOffsetMs());
  }

  protected rows(match: RecentMatch) {
    return PLACEMENTS.map((placement, index) => ({
      placement,
      rank: String(index + 1),
      faction: match.placements[placement],
      points: GAME_CONFIG.pointsByPlacement[placement],
    }));
  }
}
