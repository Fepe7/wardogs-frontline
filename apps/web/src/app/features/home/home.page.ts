import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { GAME_CONFIG } from '@frontline/core';

@Component({
  selector: 'app-home-page',
  imports: [TranslocoPipe],
  template: `
    <section class="py-12 sm:py-20">
      <h1
        class="max-w-4xl font-display text-5xl leading-none font-extrabold text-balance sm:text-7xl"
      >
        {{ 'home.title' | transloco }}
      </h1>
      <p class="mt-6 max-w-prose text-lg text-chalk-muted">{{ 'home.lead' | transloco }}</p>
    </section>

    <section aria-labelledby="how-title" class="border-t border-grid py-12">
      <h2 id="how-title" class="font-display text-3xl font-bold">
        {{ 'home.howTitle' | transloco }}
      </h2>
      <ol class="mt-8 grid gap-8 sm:grid-cols-3">
        @for (step of steps; track step) {
          <li class="border-l-2 border-grid pl-4">
            <h3 class="font-display text-xl font-bold">
              {{ 'home.steps.' + step + '.title' | transloco }}
            </h3>
            <p class="mt-2 max-w-prose text-chalk-muted">
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
