import { Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toSignal } from '@angular/core/rxjs-interop';
import { BattleList } from './battle-list';
import { FactionPatterns } from './faction-patterns';
import { FactionSwatch } from './faction-swatch';
import { HexMap, type MapAttack } from './hex-map';
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
            [attacks]="attacks()"
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
              @if (store.openBattles().length > 0) {
                <p class="mt-4 flex items-center gap-3 text-sm text-chalk-muted">
                  <svg viewBox="0 0 20 10" aria-hidden="true" class="h-3 w-6 shrink-0">
                    <line x1="1" y1="5" x2="13" y2="5" class="stroke-chalk" stroke-width="2" />
                    <path d="M12,1 L19,5 L12,9 z" class="fill-chalk" />
                  </svg>
                  {{ 'warMap.attackKey' | transloco }}
                </p>
              }
            </section>
            <section aria-live="polite">
              <app-battle-list
                [battles]="store.openBattles()"
                [sectorNames]="store.sectorNames()"
                [timeOffsetMs]="store.demoOffsetMs()"
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
