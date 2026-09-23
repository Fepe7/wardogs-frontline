import { Component, input } from '@angular/core';
import type { Faction } from '@frontline/core';
import { patternOf } from './faction-patterns';

/** Small hex in a faction's color and texture, as in the map. Decorative: names go next to it. */
@Component({
  selector: 'app-faction-swatch',
  host: { 'aria-hidden': 'true', class: 'inline-block size-5 shrink-0' },
  template: `
    <svg viewBox="-10 -10 20 20" class="size-full">
      <polygon points="0,-10 8.66,-5 8.66,5 0,10 -8.66,5 -8.66,-5" [class]="fills[faction()]" />
      <polygon
        points="0,-10 8.66,-5 8.66,5 0,10 -8.66,5 -8.66,-5"
        [attr.fill]="pattern(faction())"
      />
    </svg>
  `,
})
export class FactionSwatch {
  readonly faction = input.required<Faction>();

  protected readonly fills = {
    lonestar: 'fill-lonestar',
    valkyra: 'fill-valkyra',
    manticore: 'fill-manticore',
  } as const;
  protected readonly pattern = patternOf;
}
