import { Component, computed, input } from '@angular/core';
import type { Sector, SectorId } from '@frontline/core';
import { patternOf } from './faction-patterns';
import { hexPoints, viewBoxFor } from './hex-layout';

/**
 * The war map: one hex per sector, filled with its owner's color and texture. Sectors
 * under attack pulse; that is the only motion on the page. The text alternative is
 * the summary plus the legend and the battle list next to the map.
 */
@Component({
  selector: 'app-hex-map',
  template: `
    <svg
      role="img"
      [attr.viewBox]="viewBox()"
      aria-labelledby="war-map-title war-map-summary"
      class="h-auto w-full"
    >
      <title id="war-map-title">{{ label() }}</title>
      <desc id="war-map-summary">{{ summary() }}</desc>
      @for (hex of hexes(); track hex.id) {
        <g>
          <title>{{ hex.name }}</title>
          <polygon
            [attr.points]="hex.points"
            [class]="'stroke-table ' + fills[hex.owner]"
            stroke-width="1"
          />
          <polygon [attr.points]="hex.points" [attr.fill]="hex.pattern" />
        </g>
      }
      <!-- Drawn last, so no neighbouring hex covers the outline of a sector under attack. -->
      @for (hex of hexesUnderAttack(); track hex.id) {
        <polygon
          [attr.points]="hex.points"
          class="front-pulse pointer-events-none fill-none stroke-chalk"
          stroke-width="2.2"
        />
      }
    </svg>
  `,
  styles: `
    .front-pulse {
      animation: front-pulse 1.8s ease-in-out infinite;
    }
    @keyframes front-pulse {
      50% {
        stroke-opacity: 0.25;
      }
    }
  `,
})
export class HexMap {
  readonly sectors = input.required<readonly Sector[]>();
  readonly underAttack = input.required<ReadonlySet<SectorId>>();
  readonly label = input.required<string>();
  readonly summary = input.required<string>();

  protected readonly fills = {
    lonestar: 'fill-lonestar',
    valkyra: 'fill-valkyra',
    manticore: 'fill-manticore',
  } as const;

  protected readonly viewBox = computed(() => viewBoxFor(this.sectors().map((s) => s.coord)));
  protected readonly hexes = computed(() =>
    this.sectors().map((sector) => ({
      id: sector.id,
      name: sector.name,
      owner: sector.owner,
      points: hexPoints(sector.coord),
      pattern: patternOf(sector.owner),
      underAttack: this.underAttack().has(sector.id),
    })),
  );
  protected readonly hexesUnderAttack = computed(() =>
    this.hexes().filter((hex) => hex.underAttack),
  );
}
