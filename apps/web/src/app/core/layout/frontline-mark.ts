import { Component } from '@angular/core';

/**
 * Project mark: a hexagon split into three wedges, one per faction, like the war map.
 * Original artwork; no official Wardogs assets are used (CLAUDE.md, red lines).
 */
@Component({
  selector: 'app-frontline-mark',
  host: { 'aria-hidden': 'true', class: 'inline-block' },
  template: `
    <svg viewBox="-10 -10 20 20" class="size-full">
      <polygon points="0,0 0,-10 -8.66,-5 -8.66,5" class="fill-lonestar" />
      <polygon points="0,0 -8.66,5 0,10 8.66,5" class="fill-valkyra" />
      <polygon points="0,0 8.66,5 8.66,-5 0,-10" class="fill-manticore" />
    </svg>
  `,
})
export class FrontlineMark {}
