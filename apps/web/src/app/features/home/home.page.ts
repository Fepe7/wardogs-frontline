import { Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { GAME_CONFIG } from '@frontline/core';
import { environment } from '../../../environments/environment';
import { LastMatch } from '../war-map/last-match';
import { WarMap } from '../war-map/war-map';
import { WarMapStore } from '../war-map/war-map.store';

@Component({
  selector: 'app-home-page',
  imports: [TranslocoPipe, LastMatch, WarMap],
  // One store for the page: the board header and the board share the live war.
  providers: [WarMapStore],
  template: `
    <section aria-labelledby="front-title" class="board mt-5 sm:mt-6">
      <header
        class="grid gap-5 border-b border-grid px-4 py-4 sm:px-8 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-end lg:gap-10"
      >
        <div>
          <h1
            class="font-display font-wide text-[1.9rem] leading-[0.95] font-black text-balance sm:text-5xl lg:text-[2.6rem]"
          >
            {{ 'home.title' | transloco }}
          </h1>
          <p class="mt-2 max-w-[70ch] text-chalk-muted">{{ 'home.lead' | transloco }}</p>
          <p class="mt-1 text-sm text-chalk-muted">{{ 'home.kicker' | transloco }}</p>
        </div>
        <app-last-match
          [match]="store.latestMatch()"
          [simulated]="demoMode"
          [timeOffsetMs]="store.demoOffsetMs()"
        />
      </header>
      <app-war-map />
    </section>

    <section aria-labelledby="how-title" class="py-14 sm:py-20">
      <h2 id="how-title" class="font-display font-wide text-3xl font-black sm:text-4xl">
        {{ 'home.howTitle' | transloco }}
      </h2>
      <ol class="mt-8 grid gap-10 sm:grid-cols-3 sm:gap-8">
        @for (step of steps; track step) {
          <li class="border-t border-grid pt-5">
            <h3 class="font-display text-2xl font-extrabold">
              {{ 'home.steps.' + step + '.title' | transloco }}
            </h3>
            <p class="mt-3 max-w-prose text-chalk-muted">
              {{ 'home.steps.' + step + '.text' | transloco: points }}
            </p>
          </li>
        }
      </ol>
    </section>
  `,
})
export class HomePage {
  protected readonly store = inject(WarMapStore);
  protected readonly demoMode = environment.demoMode;
  protected readonly steps = ['vote', 'fight', 'hold'] as const;
  /** From the game config, so the rules shown never drift from the rules applied. */
  protected readonly points = GAME_CONFIG.pointsByPlacement;
}
