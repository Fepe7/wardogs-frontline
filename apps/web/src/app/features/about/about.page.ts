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

/**
 * The project explained for Bulkhead, as a contract dossier in the board's language:
 * what it is, how the demo runs, what it would need and who would run it.
 */
@Component({
  selector: 'app-about-page',
  imports: [TranslocoPipe],
  template: `
    <article class="board mt-5 mb-14 sm:mt-6 sm:mb-20">
      <header class="border-b border-grid px-4 py-6 sm:px-8 sm:py-8">
        <h1
          class="font-display font-wide text-[1.9rem] leading-[0.95] font-black text-balance sm:text-5xl"
        >
          {{ 'about.title' | transloco }}
        </h1>
        <p class="mt-4 max-w-[62ch] text-lg text-chalk-muted">{{ 'about.lead' | transloco }}</p>
      </header>

      <div class="lg:grid lg:grid-cols-[15rem_minmax(0,1fr)]">
        <!-- The dossier's index: a long read, so every section stays one click away. -->
        <nav
          [attr.aria-label]="'about.contents' | transloco"
          class="hidden border-grid lg:block lg:border-r"
        >
          <ul class="sticky top-6 px-8 py-8">
            @for (section of sections; track section.id) {
              <li class="border-t border-grid first:border-t-0">
                <a
                  [href]="'#' + section.id"
                  class="block py-2 font-display text-base font-extrabold text-chalk-muted hover:text-chalk"
                  >{{ section.title | transloco }}</a
                >
              </li>
            }
          </ul>
        </nav>

        <div class="px-4 pb-10 sm:px-8 lg:px-12">
          <section aria-labelledby="about-what" class="dossier-section">
            <h2 id="about-what" class="dossier-title">{{ 'about.whatTitle' | transloco }}</h2>
            <p class="dossier-text">{{ 'about.whatText' | transloco: points }}</p>
          </section>

          <section aria-labelledby="about-value" class="dossier-section">
            <h2 id="about-value" class="dossier-title">{{ 'about.valueTitle' | transloco }}</h2>
            <ul class="dossier-list">
              @for (point of valuePoints; track point) {
                <li>{{ 'about.valuePoints.' + point | transloco }}</li>
              }
            </ul>
          </section>

          <section aria-labelledby="about-demo" class="dossier-section">
            <h2 id="about-demo" class="dossier-title">{{ 'about.demoTitle' | transloco }}</h2>
            <p class="dossier-text">{{ 'about.demoText' | transloco: pace }}</p>
          </section>

          <section aria-labelledby="about-connect" class="dossier-section">
            <h2 id="about-connect" class="dossier-title">
              {{ 'about.connectTitle' | transloco }}
            </h2>
            <p class="dossier-text">{{ 'about.connectText' | transloco }}</p>
            <figure class="sheet">
              <figcaption class="sheet-caption">{{ 'about.sheetMatch' | transloco }}</figcaption>
              <pre class="sheet-body"><code>{{ resultMessage }}</code></pre>
            </figure>
            <ul class="dossier-list">
              @for (note of notes; track note) {
                <li>{{ 'about.connectNotes.' + note | transloco }}</li>
              }
            </ul>
          </section>

          <section aria-labelledby="about-rewards" class="dossier-section">
            <h2 id="about-rewards" class="dossier-title">
              {{ 'about.rewardsTitle' | transloco }}
            </h2>
            <p class="dossier-text">{{ 'about.rewardsText' | transloco }}</p>
            <ul class="dossier-list">
              @for (point of rewardPoints; track point) {
                <li>{{ 'about.rewardsPoints.' + point | transloco }}</li>
              }
            </ul>
            <p class="dossier-text">{{ 'about.rewardsDataText' | transloco }}</p>
            <figure class="sheet">
              <figcaption class="sheet-caption">{{ 'about.sheetSeason' | transloco }}</figcaption>
              <pre class="sheet-body"><code>{{ seasonResult }}</code></pre>
            </figure>
            <p class="dossier-text text-chalk-muted">{{ 'about.rewardsFit' | transloco }}</p>
          </section>

          <section aria-labelledby="about-quality" class="dossier-section">
            <h2 id="about-quality" class="dossier-title">
              {{ 'about.qualityTitle' | transloco }}
            </h2>
            <ul class="dossier-list">
              @for (point of qualityPoints; track point) {
                <li>{{ 'about.qualityPoints.' + point | transloco }}</li>
              }
            </ul>
          </section>

          <!-- Closes the dossier like a signature block. -->
          <section aria-labelledby="about-author" class="signature">
            <h2 id="about-author" class="font-display font-wide text-3xl font-black">
              {{ 'about.authorTitle' | transloco }}
            </h2>
            <p class="dossier-text">{{ 'about.authorText' | transloco }}</p>
            <p class="dossier-text">{{ 'about.authorOffer' | transloco }}</p>
            <ul class="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-8">
              @for (link of links; track link.href) {
                <li class="text-sm text-chalk-muted">
                  {{ link.label | transloco }}:
                  <a
                    [href]="link.href"
                    class="font-semibold text-chalk underline decoration-signal underline-offset-4 hover:text-signal"
                    >{{ link.text }}</a
                  >
                </li>
              }
            </ul>
          </section>
        </div>
      </div>
    </article>
  `,
  styles: `
    .dossier-section {
      scroll-margin-top: 1.5rem;
      padding-block: 2.5rem 0.5rem;
      border-top: 1px solid var(--color-grid);
    }
    .dossier-section:first-child {
      border-top: 0;
    }
    .dossier-title {
      font-family: var(--font-display);
      font-stretch: 72%;
      font-weight: 900;
      font-size: 1.5rem;
      line-height: 1;
      text-transform: uppercase;
    }
    .dossier-text {
      max-width: 68ch;
      margin-top: 0.9rem;
      line-height: 1.65;
    }
    .dossier-list {
      max-width: 68ch;
      margin-top: 1rem;
      display: grid;
      gap: 0.6rem;
      line-height: 1.6;
    }
    /* A small gunmetal tile as the bullet, from the board's own material. */
    .dossier-list li {
      position: relative;
      padding-left: 1.4rem;
    }
    .dossier-list li::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0.55em;
      width: 0.55rem;
      height: 0.55rem;
      border-radius: 2px;
      background: var(--color-grid);
    }
    /* A technical sheet for each proposed message. */
    .sheet {
      max-width: 68ch;
      margin-top: 1.25rem;
      border: 1px solid var(--color-grid);
      background: var(--color-table);
    }
    .sheet-caption {
      padding: 0.5rem 1rem;
      border-bottom: 1px solid var(--color-grid);
      font-family: var(--font-display);
      font-stretch: 72%;
      font-weight: 800;
      font-size: 0.875rem;
      text-transform: uppercase;
      color: var(--color-signal);
    }
    .sheet-body {
      overflow-x: auto;
      padding: 1rem;
      font-family: var(--font-code);
      font-size: 0.85rem;
      line-height: 1.6;
    }
    .signature {
      margin-top: 2.5rem;
      padding: 2rem 0 0.5rem;
      border-top: 6px solid var(--color-grid);
      scroll-margin-top: 1.5rem;
    }
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
  /** The dossier's index, in reading order. */
  protected readonly sections = [
    { id: 'about-what', title: 'about.whatTitle' },
    { id: 'about-value', title: 'about.valueTitle' },
    { id: 'about-demo', title: 'about.demoTitle' },
    { id: 'about-connect', title: 'about.connectTitle' },
    { id: 'about-rewards', title: 'about.rewardsTitle' },
    { id: 'about-quality', title: 'about.qualityTitle' },
    { id: 'about-author', title: 'about.authorTitle' },
  ] as const;
  protected readonly links = [
    { label: 'about.authorProfile', href: 'https://github.com/Fepe7', text: 'github.com/Fepe7' },
    {
      label: 'about.authorCode',
      href: 'https://github.com/Fepe7/wardogs-frontline',
      text: 'github.com/Fepe7/wardogs-frontline',
    },
  ] as const;
}
