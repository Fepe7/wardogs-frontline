import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Always visible in the demo, so nobody takes simulated results for real ones. The lever
 * that skips an hour lives on the board itself, next to the battles it moves.
 */
@Component({
  selector: 'app-demo-banner',
  imports: [TranslocoPipe],
  template: `
    <p
      role="note"
      class="border-b border-grid bg-table-raised px-4 py-2 text-center text-sm text-chalk-muted"
    >
      <span aria-hidden="true" class="me-2 inline-block size-2 rounded-full bg-signal"></span>
      {{ 'demo.notice' | transloco }}
    </p>
  `,
})
export class DemoBanner {}
