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
  host: { class: 'flex flex-col gap-3' },
  template: `
    <button
      type="button"
      (click)="skip()"
      [disabled]="state().kind === 'running'"
      class="lever group flex w-full items-center justify-between gap-4 bg-signal px-5 py-2 text-left font-display text-2xl font-black text-table disabled:cursor-wait"
    >
      {{ (state().kind === 'running' ? 'demo.fastForwarding' : 'demo.fastForward') | transloco }}
      <!-- The lever: a knob in a slot, thrown down while the hour is being skipped. -->
      <svg viewBox="0 0 28 44" aria-hidden="true" class="h-11 w-7 shrink-0">
        <rect x="10" y="3" width="8" height="38" rx="4" class="fill-table/25" />
        <rect x="12.5" y="6" width="3" height="32" rx="1.5" class="fill-table/70" />
        <g class="lever-knob" [class.lever-knob--pulled]="state().kind === 'running'">
          <rect x="3" y="4" width="22" height="9" rx="2" class="fill-table" />
          <rect x="3" y="4" width="22" height="3" rx="1.5" class="fill-chalk/15" />
        </g>
      </svg>
    </button>
    <p role="status" class="min-h-5 text-sm text-chalk-muted">
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
  styles: `
    .lever {
      transition:
        transform 160ms var(--ease-out),
        background-color 160ms ease;
    }
    .lever:active:not(:disabled) {
      transform: scale(0.98);
    }
    @media (hover: hover) and (pointer: fine) {
      .lever:hover:not(:disabled) {
        background-color: var(--color-chalk);
      }
    }
    .lever-knob {
      transition: transform 240ms var(--ease-out);
    }
    .lever-knob--pulled {
      transform: translateY(26px);
    }
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
