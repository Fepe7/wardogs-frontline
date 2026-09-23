import { computed, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { patchState, signalStore, withComputed, withHooks, withState } from '@ngrx/signals';
import {
  FACTIONS,
  type OpenBattle,
  type RecentMatch,
  type Sector,
  type SectorId,
} from '@frontline/core';
import { environment } from '../../../environments/environment';
import { WarMapSource } from './war-map.source';

type WarMapStatus = 'loading' | 'ready' | 'not-started' | 'error';

interface WarMapState {
  readonly status: WarMapStatus;
  readonly sectors: readonly Sector[];
  readonly openBattles: readonly OpenBattle[];
  /** Newest first; the board replays the latest one. */
  readonly recentMatches: readonly RecentMatch[];
  /** Demo only: the demo clock runs this far ahead of real time. */
  readonly demoOffsetMs: number;
}

const initialState: WarMapState = {
  status: 'loading',
  sectors: [],
  openBattles: [],
  recentMatches: [],
  demoOffsetMs: 0,
};

/** State of the war map feature: the live map and the battles in progress. */
export const WarMapStore = signalStore(
  withState(initialState),
  withComputed(({ sectors, recentMatches }) => ({
    territory: computed(() =>
      FACTIONS.map((faction) => ({
        faction,
        sectors: sectors().filter((sector) => sector.owner === faction).length,
      })),
    ),
    latestMatch: computed((): RecentMatch | null => recentMatches()[0] ?? null),
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
        .watchRecentMatches()
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (recentMatches) => {
            patchState(store, { recentMatches });
          },
          // Optional on the board: without it the war still reads fine, so no error state.
          error: () => {
            patchState(store, { recentMatches: [] });
          },
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
