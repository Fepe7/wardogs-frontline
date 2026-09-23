import { Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';

/** Always visible in the demo, so nobody takes simulated results for real ones. */
@Component({
  selector: 'app-demo-banner',
  imports: [TranslocoPipe],
  template: `
    <p
      role="note"
      class="border-b border-dashed border-grid bg-table-raised px-4 py-2 text-center text-sm"
    >
      {{ 'demo.notice' | transloco }}
    </p>
  `,
})
export class DemoBanner {}
