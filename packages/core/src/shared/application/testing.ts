import type { Clock, EventOutbox, IdGenerator, IntegrationEvent, TransactionRunner } from './ports';

/** In-memory adapters for use case tests. Not used in production code. */

export const fixedClock = (now: Date): Clock => ({ now: () => now });

export const sequentialIds = (prefix: string): IdGenerator => {
  let counter = 0;
  return {
    next: () => {
      counter += 1;
      return `${prefix}-${String(counter)}`;
    },
  };
};

export class InMemoryOutbox implements EventOutbox {
  readonly events: IntegrationEvent[] = [];

  add(event: IntegrationEvent): void {
    this.events.push(event);
  }
}

export const inMemoryTransaction = <Context>(context: Context): TransactionRunner<Context> => ({
  run: (work) => work(context),
});
