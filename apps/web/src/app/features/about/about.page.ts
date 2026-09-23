import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { GAME_CONFIG } from '@frontline/core';

/**
 * Example of the result message proposed to Bulkhead (docs/DISEÑO.md §5). It is exactly
 * what the war needs to score a match (see MatchApproved), and nothing about players.
 */
export const RESULT_MESSAGE_EXAMPLE = {
  matchId: '7c9e6679-7425-40de-944b-e07fc1f90ae7',
  endedAt: '2026-10-01T20:14:05Z',
  placements: { first: 'valkyra', second: 'lonestar', third: 'manticore' },
} as const;

/**
 * Example of what the war would send back at the end of a season, so WARDOGS can reward
 * the winning faction's players by what they contributed (docs/DISEÑO.md §5). Only the
 * winner and the matches that counted: Bulkhead already knows who played each one.
 */
export const SEASON_RESULT_EXAMPLE = {
  seasonId: 'season-1',
  endedAt: '2026-11-05T20:00:00Z',
  winner: 'manticore',
  countedMatchIds: ['7c9e6679-7425-40de-944b-e07fc1f90ae7', '1b4e28ba-2fa1-11d2-883f-0016d3cca427'],
} as const;

/** The project explained for Bulkhead: what it is, how the demo runs and what it would need. */
@Component({
  selector: 'app-about-page',
  imports: [TranslocoPipe],
  template: `
    <article class="max-w-prose py-12 sm:py-20">
      <h1 class="font-display text-4xl leading-[0.95] font-black text-balance sm:text-6xl">
        {{ 'about.title' | transloco }}
      </h1>
      <p class="mt-6 text-lg text-chalk-muted">{{ 'about.lead' | transloco }}</p>

      <section aria-labelledby="about-what" class="mt-12">
        <h2 id="about-what" class="font-display text-3xl font-bold">
          {{ 'about.whatTitle' | transloco }}
        </h2>
        <p class="mt-3">{{ 'about.whatText' | transloco: points }}</p>
      </section>

      <section aria-labelledby="about-value" class="mt-12">
        <h2 id="about-value" class="font-display text-3xl font-bold">
          {{ 'about.valueTitle' | transloco }}
        </h2>
        <ul class="mt-4 list-disc space-y-2 pl-5 marker:text-chalk-muted">
          @for (point of valuePoints; track point) {
            <li>{{ 'about.valuePoints.' + point | transloco }}</li>
          }
        </ul>
      </section>

      <section aria-labelledby="about-demo" class="mt-12">
        <h2 id="about-demo" class="font-display text-3xl font-bold">
          {{ 'about.demoTitle' | transloco }}
        </h2>
        <p class="mt-3">{{ 'about.demoText' | transloco: pace }}</p>
      </section>

      <section aria-labelledby="about-connect" class="mt-12">
        <h2 id="about-connect" class="font-display text-3xl font-bold">
          {{ 'about.connectTitle' | transloco }}
        </h2>
        <p class="mt-3">{{ 'about.connectText' | transloco }}</p>
        <pre
          class="mt-4 overflow-x-auto rounded-sm border border-grid bg-table-raised p-4 text-sm"
        ><code>{{ resultMessage }}</code></pre>
        <ul class="mt-4 list-disc space-y-2 pl-5 marker:text-chalk-muted">
          @for (note of notes; track note) {
            <li>{{ 'about.connectNotes.' + note | transloco }}</li>
          }
        </ul>
      </section>

      <section aria-labelledby="about-rewards" class="mt-12">
        <h2 id="about-rewards" class="font-display text-3xl font-bold">
          {{ 'about.rewardsTitle' | transloco }}
        </h2>
        <p class="mt-3">{{ 'about.rewardsText' | transloco }}</p>
        <ul class="mt-4 list-disc space-y-2 pl-5 marker:text-chalk-muted">
          @for (point of rewardPoints; track point) {
            <li>{{ 'about.rewardsPoints.' + point | transloco }}</li>
          }
        </ul>
        <p class="mt-4">{{ 'about.rewardsDataText' | transloco }}</p>
        <pre
          class="mt-4 overflow-x-auto rounded-sm border border-grid bg-table-raised p-4 text-sm"
        ><code>{{ seasonResult }}</code></pre>
        <p class="mt-4 text-chalk-muted">{{ 'about.rewardsFit' | transloco }}</p>
      </section>

      <section aria-labelledby="about-quality" class="mt-12">
        <h2 id="about-quality" class="font-display text-3xl font-bold">
          {{ 'about.qualityTitle' | transloco }}
        </h2>
        <ul class="mt-4 list-disc space-y-2 pl-5 marker:text-chalk-muted">
          @for (point of qualityPoints; track point) {
            <li>{{ 'about.qualityPoints.' + point | transloco }}</li>
          }
        </ul>
      </section>

      <section aria-labelledby="about-author" class="mt-12 border-t border-grid pt-12">
        <h2 id="about-author" class="font-display text-3xl font-bold">
          {{ 'about.authorTitle' | transloco }}
        </h2>
        <p class="mt-3">{{ 'about.authorText' | transloco }}</p>
        <p class="mt-3">{{ 'about.authorOffer' | transloco }}</p>
        <ul class="mt-4 space-y-1">
          @for (link of links; track link.href) {
            <li>
              {{ link.label | transloco }}:
              <a [href]="link.href" class="underline underline-offset-4 hover:text-chalk-muted">{{
                link.text
              }}</a>
            </li>
          }
        </ul>
      </section>
    </article>
  `,
})
export class AboutPage {
  protected readonly points = GAME_CONFIG.pointsByPlacement;
  protected readonly pace = {
    demoVoteHours: GAME_CONFIG.pace.demo.voteRoundHours,
    demoBattleHours: GAME_CONFIG.pace.demo.battleHours,
    seasonVoteHours: GAME_CONFIG.pace.standard.voteRoundHours,
    seasonBattleHours: GAME_CONFIG.pace.standard.battleHours,
  };
  protected readonly resultMessage = JSON.stringify(RESULT_MESSAGE_EXAMPLE, null, 2);
  protected readonly notes = ['privacy', 'signed', 'idempotent', 'pull'] as const;
  protected readonly seasonResult = JSON.stringify(SEASON_RESULT_EXAMPLE, null, 2);
  protected readonly rewardPoints = ['when', 'who', 'what', 'threshold'] as const;
  protected readonly valuePoints = ['stakes', 'return', 'story', 'season'] as const;
  protected readonly qualityPoints = ['security', 'tests', 'cost', 'access', 'brand'] as const;
  protected readonly links = [
    { label: 'about.authorProfile', href: 'https://github.com/Fepe7', text: 'github.com/Fepe7' },
    {
      label: 'about.authorCode',
      href: 'https://github.com/Fepe7/wardogs-frontline',
      text: 'github.com/Fepe7/wardogs-frontline',
    },
  ] as const;
}
