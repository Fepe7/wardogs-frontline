import { afterNextRender, computed, DestroyRef, inject, signal, type Signal } from '@angular/core';
import { WarMapStore } from './war-map.store';

/** The board's clock ticks often enough to keep the minutes left exact. */
const CLOCK_TICK_MS = 15_000;

/**
 * Time on the war's clock, ticking in the browser only (the server render has no
 * running clock). In the demo it runs ahead of real time by the fast-forward offset.
 * Call it in an injection context of a component that has a WarMapStore.
 */
export const injectWarClock = (): Signal<number> => {
  const store = inject(WarMapStore);
  const destroyRef = inject(DestroyRef);
  const nowMs = signal(0);
  afterNextRender(() => {
    nowMs.set(Date.now());
    const tick = setInterval(() => {
      nowMs.set(Date.now());
    }, CLOCK_TICK_MS);
    destroyRef.onDestroy(() => {
      clearInterval(tick);
    });
  });
  return computed(() => nowMs() + store.demoOffsetMs());
};
