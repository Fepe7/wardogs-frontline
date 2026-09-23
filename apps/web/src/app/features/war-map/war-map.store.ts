import { computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { patchState, signalStore, withComputed, withHooks, withState } from '@ngrx/signals';
import { FACTIONS, type OpenBattle, type Sector, type SectorId } from '@frontline/core';
import { environment } from '../../../environments/environment';
import { WarMapSource } from './war-map.source';

type WarMapStatus = 'loading' | 'ready' | 'not-started' | 'error';

interface WarMapState {
  readonly status: WarMapStatus;
  readonly sectors: readonly Sector[];
  readonly openBattles: readonly OpenBattle[];
  /** Demo only: the demo clock runs this far ahead of real time. */
  readonly demoOffsetMs: number;
}

const initialState: WarMapState = {
  status: 'loading',
  sectors: [],
  openBattles: [],
  demoOffsetMs: 0,
};

/** State of the war map feature: the live map and the battles in progress. */
export const WarMapStore = signalStore(
  withState(initialState),
  withComputed(({ sectors, openBattles }) => ({
    sectorsUnderAttack: computed(
      (): ReadonlySet<SectorId> => new Set(openBattles().map((battle) => battle.sectorId)),
    ),
    territory: computed(() =>
      FACTIONS.map((faction) => ({
        faction,
        sectors: sectors().filter((sector) => sector.owner === faction).length,
      })),
    ),
    sectorNames: computed(
      (): ReadonlyMap<SectorId, string> =>
        new Map(sectors().map((sector) => [sector.id, sector.name])),
    ),
  })),
  withHooks({
    onInit(store, source = inject(WarMapSource)) {
      if (environment.demoMode) {
        source
          .watchDemoOffset()
          .pipe(takeUntilDestroyed())
          .subscribe((demoOffsetMs) => {
            patchState(store, { demoOffsetMs });
          });
      }
      const failed = () => {
        patchState(store, { status: 'error' });
      };
      source
        .watchMap()
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (sectors) => {
            patchState(
              store,
              sectors ? { status: 'ready', sectors } : { status: 'not-started', sectors: [] },
            );
          },
          error: failed,
        });
      source
        .watchOpenBattles()
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (openBattles) => {
            patchState(store, { openBattles });
          },
          error: failed,
        });
    },
  }),
);
