import { afterNextRender, Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { environment } from '../../../environments/environment';
import { FastForwardButton } from '../demo/fast-forward-button';
import { BattleList } from './battle-list';
import { FactionPatterns } from './faction-patterns';
import { FactionSwatch } from './faction-swatch';
import { FlapText } from './flap-text';
import { HexMap, type MapAttack } from './hex-map';
import { WarMapStore } from './war-map.store';

/** The board's clock ticks often enough to keep the minutes left exact. */
const CLOCK_TICK_MS = 15_000;
/** Standings are set in billing weight: the more sectors, the bigger the name. */
const STANDING_BASE_REM = 0.9;
const STANDING_REM_PER_SHARE = 2.4;
const TWO_TILES = 2;

/**
 * The live war as a dispatch board: map, standings, battles and, in the demo, the lever.
 * The page provides the WarMapStore, so the board header can share the same state.
 */
@Component({
  selector: 'app-war-map',
  imports: [
    TranslocoPipe,
    BattleList,
    FactionPatterns,
    FactionSwatch,
    FastForwardButton,
    FlapText,
    HexMap,
  ],
  template: `
    <app-faction-patterns />
    <h2 id="front-title" class="sr-only">{{ 'warMap.title' | transloco }}</h2>
    @switch (store.status()) {
      @case ('ready') {
        <div class="grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div class="flex flex-col border-grid lg:border-r">
            <div class="p-4 sm:px-8 sm:pt-6 sm:pb-4">
              <app-hex-map
                class="mx-auto block w-full max-w-[27rem]"
                [sectors]="store.sectors()"
                [attacks]="attacks()"
                [label]="'warMap.mapLabel' | transloco"
                [summary]="summary()"
              />
              @if (store.openBattles().length > 0) {
                <p class="mt-3 flex items-center justify-center gap-3 text-sm text-chalk-muted">
                  <svg viewBox="0 0 20 10" aria-hidden="true" class="h-3 w-6 shrink-0">
                    <line x1="1" y1="5" x2="13" y2="5" class="stroke-chalk" stroke-width="2" />
                    <path d="M12,1 L19,5 L12,9 z" class="fill-chalk" />
                  </svg>
                  {{ 'warMap.attackKey' | transloco }}
                </p>
              }
            </div>
            <section
              aria-labelledby="territory-title"
              class="border-t border-grid px-4 py-4 sm:px-8 lg:border-b"
            >
              <h3 id="territory-title" class="font-display text-lg font-extrabold text-chalk-muted">
                {{ 'warMap.territory' | transloco }}
              </h3>
              <dl class="mt-2 flex flex-wrap items-end gap-x-8 gap-y-3">
                @for (entry of standings(); track entry.faction) {
                  <div class="flex items-center gap-3">
                    <dt
                      class="flex items-center gap-2 font-display leading-none font-black"
                      [style.font-size.rem]="entry.size"
                    >
                      <app-faction-swatch [faction]="entry.faction" class="size-[0.7em]" />
                      {{ 'factions.' + entry.faction | transloco }}
                    </dt>
                    <dd>
                      <app-flap-text class="text-lg" [text]="entry.tiles" />
                    </dd>
                  </div>
                }
              </dl>
            </section>
          </div>
          <div class="flex flex-col border-t border-grid lg:border-t-0">
            <section aria-live="polite" class="px-4 pt-5 sm:px-8">
              <app-battle-list
                [battles]="store.openBattles()"
                [sectorNames]="store.sectorNames()"
                [warNowMs]="warNowMs()"
                [simulated]="demoMode"
                [latestMatch]="store.latestMatch()"
              />
            </section>
            @if (demoMode) {
              <app-fast-forward-button class="mt-auto border-t border-grid p-4 sm:px-8" />
            }
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
  `,
})
export class WarMap {
  protected readonly store = inject(WarMapStore);
  private readonly transloco = inject(TranslocoService);
  private readonly language = toSignal(this.transloco.langChanges$);
  protected readonly demoMode = environment.demoMode;

  /** Real time, read in the browser only (the server render has no running clock). */
  private readonly nowMs = signal(0);
  /** Time on the war's clock: in the demo it runs ahead by the fast-forward offset. */
  protected readonly warNowMs = computed(() => this.nowMs() + this.store.demoOffsetMs());

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.nowMs.set(Date.now());
      const tick = setInterval(() => {
        this.nowMs.set(Date.now());
      }, CLOCK_TICK_MS);
      destroyRef.onDestroy(() => {
        clearInterval(tick);
      });
    });
  }

  /** Factions ranked by sectors held, each name sized by its share of the map. */
  protected readonly standings = computed(() => {
    const total = this.store.sectors().length || 1;
    return [...this.store.territory()]
      .sort((a, b) => b.sectors - a.sectors)
      .map((entry) => ({
        ...entry,
        size: STANDING_BASE_REM + (entry.sectors / total) * STANDING_REM_PER_SHARE,
        tiles: String(entry.sectors).padStart(TWO_TILES, '0'),
      }));
  });

  /** Each battle for the map, with a tooltip naming both sides in the active language. */
  protected readonly attacks = computed((): MapAttack[] => {
    this.language();
    const faction = (id: string) => this.transloco.translate(`factions.${id}`);
    return this.store.openBattles().map((battle) => ({
      sectorId: battle.sectorId,
      attacker: battle.attacker,
      label: this.transloco.translate('warMap.attackTitle', {
        attacker: faction(battle.attacker),
        defender: faction(battle.defender),
        sector: this.store.sectorNames().get(battle.sectorId) ?? battle.sectorId,
      }),
    }));
  });

  /** Text alternative of the map for screen readers, in the active language. */
  protected readonly summary = computed(() => {
    this.language();
    const [lonestar, valkyra, manticore] = this.store.territory().map((t) => t.sectors);
    return this.transloco.translate('warMap.mapSummary', {
      lonestar,
      valkyra,
      manticore,
      battles: this.store.openBattles().length,
    });
  });
}
