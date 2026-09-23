import { Component, computed, inject, input } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import type { ResolvedBattle, SectorId } from '@frontline/core';
import { catchError, of, switchMap } from 'rxjs';
import { sectorNameOf } from '../../core/war/sector-names';
import { environment } from '../../../environments/environment';
import { BattleList } from '../war-map/battle-list';
import { FactionPatterns } from '../war-map/faction-patterns';
import { FactionSwatch } from '../war-map/faction-swatch';
import { FlapText } from '../war-map/flap-text';
import { HexMap } from '../war-map/hex-map';
import { injectWarClock } from '../war-map/war-clock';
import { WarMapSource } from '../war-map/war-map.source';
import { WarMapStore } from '../war-map/war-map.store';
import { WarReport } from '../war-map/war-report';

/**
 * One sector of the war: who holds it, the battle for it right now and its history.
 * Prerendered per sector, so a shared link names the sector before any live data.
 */
@Component({
  selector: 'app-sector-page',
  imports: [
    RouterLink,
    TranslocoPipe,
    BattleList,
    FactionPatterns,
    FactionSwatch,
    FlapText,
    HexMap,
    WarReport,
  ],
  providers: [WarMapStore],
  template: `
    <app-faction-patterns />
    @if (name(); as sectorName) {
      <article class="board mt-5 mb-14 sm:mt-6 sm:mb-20">
        <header class="border-b border-grid px-4 py-5 sm:px-8">
          <a
            routerLink="/"
            class="inline-flex items-center gap-2 font-display text-base font-extrabold text-chalk-muted hover:text-chalk"
          >
            <svg viewBox="0 0 20 10" aria-hidden="true" class="h-3 w-5 shrink-0">
              <line x1="7" y1="5" x2="19" y2="5" class="stroke-current" stroke-width="2" />
              <path d="M8,1 L1,5 L8,9 z" class="fill-current" />
            </svg>
            {{ 'sector.back' | transloco }}
          </a>
          <h1 class="mt-3 text-[1.9rem] text-chalk sm:text-4xl">
            <app-flap-text [text]="sectorName" />
          </h1>
          @if (sector(); as live) {
            <p class="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-lg">
              <app-faction-swatch [faction]="live.owner" class="size-5" />
              <span>
                {{ 'sector.heldBy' | transloco: { faction: 'factions.' + live.owner | transloco } }}
              </span>
              @if (battle(); as current) {
                <span class="font-display font-extrabold text-signal">
                  {{
                    'sector.underAttack'
                      | transloco: { faction: 'factions.' + current.attacker | transloco }
                  }}
                </span>
              }
            </p>
          }
        </header>

        @switch (store.status()) {
          @case ('ready') {
            <div class="grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
              <div class="border-grid p-4 sm:p-8 lg:border-r">
                <app-hex-map
                  class="mx-auto block w-full max-w-[24rem]"
                  [sectors]="store.sectors()"
                  [attacks]="[]"
                  [selectedSectorId]="sectorId()"
                  [label]="'warMap.mapLabel' | transloco"
                  [summary]="'sector.mapSummary' | transloco: { sector: sectorName }"
                />
              </div>
              <div class="px-4 pt-5 pb-8 sm:px-8">
                <app-battle-list
                  [battles]="battles()"
                  [sectorNames]="store.sectorNames()"
                  [warNowMs]="warNowMs()"
                  [simulated]="demoMode"
                  [latestMatch]="store.latestMatch()"
                />
                <section aria-labelledby="war-report-title" class="mt-10">
                  <app-war-report
                    [battles]="history()"
                    [sectorNames]="store.sectorNames()"
                    [timeOffsetMs]="store.demoOffsetMs()"
                    titleKey="sector.historyTitle"
                    emptyKey="sector.historyEmpty"
                    [compact]="true"
                  />
                </section>
              </div>
            </div>
          }
          @case ('not-started') {
            <p class="p-8 text-chalk-muted">{{ 'warMap.notStarted' | transloco }}</p>
          }
          @case ('error') {
            <p role="alert" class="p-8">{{ 'warMap.error' | transloco }}</p>
          }
          @default {
            <p class="p-8 text-chalk-muted">{{ 'warMap.loading' | transloco }}</p>
          }
        }
      </article>
    } @else {
      <section class="py-16">
        <h1 class="font-display font-wide text-4xl font-black">
          {{ 'sector.notFound' | transloco }}
        </h1>
        <a routerLink="/" class="mt-6 inline-block underline decoration-signal underline-offset-4">
          {{ 'sector.back' | transloco }}
        </a>
      </section>
    }
  `,
})
export class SectorPage {
  /** From the route (`/sector/:id`). */
  readonly id = input.required<string>();

  protected readonly store = inject(WarMapStore);
  private readonly source = inject(WarMapSource);
  protected readonly demoMode = environment.demoMode;

  protected readonly sectorId = computed(() => this.id() as SectorId);
  protected readonly name = computed(() => sectorNameOf(this.id()));
  protected readonly sector = computed(
    () => this.store.sectors().find((sector) => sector.id === this.id()) ?? null,
  );
  protected readonly battles = computed(() =>
    this.store.openBattles().filter((battle) => battle.sectorId === this.id()),
  );
  protected readonly battle = computed(() => this.battles()[0] ?? null);

  protected readonly warNowMs = injectWarClock();

  /** The sector's decided battles; optional, so a failed read just shows none. */
  protected readonly history = toSignal(
    toObservable(this.sectorId).pipe(
      switchMap((id) =>
        this.source
          .watchSectorHistory(id)
          .pipe(catchError(() => of<readonly ResolvedBattle[]>([]))),
      ),
    ),
    { initialValue: [] },
  );
}
