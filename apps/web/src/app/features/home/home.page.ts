import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { GAME_CONFIG } from '@frontline/core';
import { WarMap } from '../war-map/war-map';

@Component({
  selector: 'app-home-page',
  imports: [TranslocoPipe, WarMap],
  template: `
    <section aria-labelledby="front-title" class="board mt-5 sm:mt-6">
      <header class="border-b border-grid px-4 py-5 sm:px-8">
        <h1
          class="font-display font-wide text-[1.9rem] leading-[0.95] font-black text-balance sm:text-5xl lg:text-[2.75rem]"
        >
          {{ 'home.title' | transloco }}
        </h1>
        <div
          class="mt-3 flex flex-col gap-2 lg:flex-row lg:items-baseline lg:justify-between lg:gap-10"
        >
          <p class="max-w-[70ch] text-chalk-muted">{{ 'home.lead' | transloco }}</p>
          <p
            class="flex shrink-0 items-center gap-2 font-display text-lg font-extrabold text-signal"
          >
            <span aria-hidden="true" class="size-2 rounded-full bg-signal"></span>
            {{ 'home.kicker' | transloco }}
          </p>
        </div>
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
  protected readonly steps = ['vote', 'fight', 'hold'] as const;
  /** From the game config, so the rules shown never drift from the rules applied. */
  protected readonly points = GAME_CONFIG.pointsByPlacement;
}
