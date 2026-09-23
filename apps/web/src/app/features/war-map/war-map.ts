import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { BattleList } from './battle-list';
import { FactionPatterns } from './faction-patterns';
import { FactionSwatch } from './faction-swatch';
import { HexMap } from './hex-map';
import { WarMapStore } from './war-map.store';

/** The live war: map, territory of each faction and battles in progress. */
@Component({
  selector: 'app-war-map',
  imports: [TranslocoPipe, BattleList, FactionPatterns, FactionSwatch, HexMap],
  providers: [WarMapStore],
  template: `
    <app-faction-patterns />
    <h2 id="front-title" class="font-display text-3xl font-bold">
      {{ 'warMap.title' | transloco }}
    </h2>
    @switch (store.status()) {
      @case ('ready') {
        <div class="mt-6 grid gap-10 lg:grid-cols-[2fr_1fr]">
          <app-hex-map
            [sectors]="store.sectors()"
            [underAttack]="store.sectorsUnderAttack()"
            [label]="'warMap.mapLabel' | transloco"
            [summary]="summary()"
          />
          <div class="space-y-10">
            <section aria-labelledby="territory-title">
              <h3 id="territory-title" class="font-display text-2xl font-bold">
                {{ 'warMap.territory' | transloco }}
              </h3>
              <dl class="mt-4 space-y-2">
                @for (entry of store.territory(); track entry.faction) {
                  <div class="flex items-center gap-3">
                    <app-faction-swatch [faction]="entry.faction" />
                    <dt class="flex-1">{{ 'factions.' + entry.faction | transloco }}</dt>
                    <dd class="font-semibold tabular-nums">
                      {{ entry.sectors }}
                    </dd>
                  </div>
                }
              </dl>
            </section>
            <section aria-live="polite">
              <app-battle-list
                [battles]="store.openBattles()"
                [sectorNames]="store.sectorNames()"
              />
            </section>
          </div>
        </div>
      }
      @case ('not-started') {
        <p class="mt-4 text-chalk-muted">{{ 'warMap.notStarted' | transloco }}</p>
      }
      @case ('error') {
        <p role="alert" class="mt-4">{{ 'warMap.error' | transloco }}</p>
      }
      @default {
        <p class="mt-4 text-chalk-muted">{{ 'warMap.loading' | transloco }}</p>
      }
    }
  `,
})
export class WarMap {
  protected readonly store = inject(WarMapStore);
  private readonly transloco = inject(TranslocoService);
  private readonly language = toSignal(this.transloco.langChanges$);

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
