import { Component } from '@angular/core';
import type { Faction } from '@frontline/core';

/** Factions never rely on color alone (WCAG 1.4.1): each one also has its own texture. */
export const patternOf = (faction: Faction): string => `url(#faction-pattern-${faction})`;

/**
 * SVG patterns shared by the map and the legend, rendered once per page:
 * Lonestar diagonal hatching, Valkyra dots, Manticore cross-hatching.
 */
@Component({
  selector: 'app-faction-patterns',
  host: { 'aria-hidden': 'true', class: 'absolute size-0 overflow-hidden' },
  template: `
    <svg width="0" height="0">
      <defs>
        <pattern
          id="faction-pattern-lonestar"
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line x1="0" y1="0" x2="0" y2="4" class="stroke-table/45" stroke-width="1.2" />
        </pattern>
        <pattern id="faction-pattern-valkyra" width="4" height="4" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="0.8" class="fill-table/45" />
        </pattern>
        <pattern id="faction-pattern-manticore" width="4" height="4" patternUnits="userSpaceOnUse">
          <path d="M0 0L4 4M4 0L0 4" class="stroke-table/45" stroke-width="0.8" />
        </pattern>
      </defs>
    </svg>
  `,
})
export class FactionPatterns {}
