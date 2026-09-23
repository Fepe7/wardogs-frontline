import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { FastForwardButton } from './fast-forward-button';

/** Always visible in the demo, so nobody takes simulated results for real ones. */
@Component({
  selector: 'app-demo-banner',
  imports: [TranslocoPipe, FastForwardButton],
  template: `
    <div
      class="flex flex-col items-center gap-2 border-b border-dashed border-grid bg-table-raised px-4 py-2 text-center text-sm lg:flex-row lg:justify-center lg:gap-6"
    >
      <p role="note">{{ 'demo.notice' | transloco }}</p>
      <app-fast-forward-button />
    </div>
  `,
})
export class DemoBanner {}
