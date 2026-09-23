import { Component, inject, signal } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import type { FastForwardDemoResponse } from '@frontline/contracts';
import { DemoControls, failureOf, type FastForwardFailure } from './demo-controls';

type FastForwardState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'running' }
  | { readonly kind: 'done'; readonly summary: FastForwardDemoResponse }
  | { readonly kind: 'failed'; readonly reason: FastForwardFailure };

/**
 * Lets anyone watching the demo skip an hour of the war and see it move: votes close,
 * battles are fought and sectors change hands. The map updates live on its own.
 */
@Component({
  selector: 'app-fast-forward-button',
  imports: [TranslocoPipe],
  host: { class: 'flex flex-wrap items-center justify-center gap-x-3 gap-y-1' },
  template: `
    <button
      type="button"
      (click)="skip()"
      [disabled]="state().kind === 'running'"
      class="bg-signal px-3 py-1 text-xs font-bold tracking-[0.15em] text-table uppercase hover:bg-chalk disabled:cursor-wait disabled:opacity-60"
    >
      {{ (state().kind === 'running' ? 'demo.fastForwarding' : 'demo.fastForward') | transloco }}
    </button>
    <p role="status" class="text-chalk-muted">
      @switch (state().kind) {
        @case ('done') {
          {{ 'demo.fastForwarded' | transloco: summary() }}
        }
        @case ('failed') {
          {{ 'demo.' + failure() | transloco }}
        }
      }
    </p>
  `,
})
export class FastForwardButton {
  private readonly demo = inject(DemoControls);
  protected readonly state = signal<FastForwardState>({ kind: 'idle' });

  protected summary(): FastForwardDemoResponse | undefined {
    const state = this.state();
    return state.kind === 'done' ? state.summary : undefined;
  }

  protected failure(): FastForwardFailure | undefined {
    const state = this.state();
    return state.kind === 'failed' ? state.reason : undefined;
  }

  protected async skip(): Promise<void> {
    this.state.set({ kind: 'running' });
    try {
      this.state.set({ kind: 'done', summary: await this.demo.fastForward() });
    } catch (error) {
      this.state.set({ kind: 'failed', reason: failureOf(error) });
    }
  }
}
