import { Component, computed, input } from '@angular/core';
import { FACTIONS, type Faction, type Sector, type SectorId } from '@frontline/core';
import { attackArrow } from './attack-arrows';
import { patternOf } from './faction-patterns';
import { hexPoints, viewBoxFor } from './hex-layout';

/** A battle as the map shows it; `label` names both sides for the sector's tooltip. */
export interface MapAttack {
  readonly sectorId: SectorId;
  readonly attacker: Faction;
  readonly label: string;
}

/**
 * The war map: one hex per sector, filled with its owner's color and texture. Each
 * battle gets an arrow in the attacker's color from its territory, and the sector
 * pulses; that is the only motion on the page. The text alternative is the summary
 * plus the legend and the battle list next to the map.
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
      <defs>
        @for (faction of factions; track faction) {
          <marker
            [attr.id]="'attack-head-' + faction"
            viewBox="0 0 10 10"
            refX="4"
            refY="5"
            markerWidth="3.2"
            markerHeight="3.2"
            orient="auto"
          >
            <path d="M0,0 L10,5 L0,10 z" [class]="'stroke-table ' + fills[faction]" />
          </marker>
        }
      </defs>
      @for (hex of hexes(); track hex.id) {
        <g>
          <title>{{ hex.title }}</title>
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
      @for (arrow of arrows(); track arrow.sectorId) {
        <g class="pointer-events-none" stroke-linecap="round">
          <line
            [attr.x1]="arrow.from.x"
            [attr.y1]="arrow.from.y"
            [attr.x2]="arrow.to.x"
            [attr.y2]="arrow.to.y"
            class="stroke-table"
            stroke-width="3.6"
          />
          <line
            [attr.x1]="arrow.from.x"
            [attr.y1]="arrow.from.y"
            [attr.x2]="arrow.to.x"
            [attr.y2]="arrow.to.y"
            [class]="strokes[arrow.attacker]"
            stroke-width="2"
            [attr.marker-end]="'url(#attack-head-' + arrow.attacker + ')'"
          />
        </g>
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
  readonly attacks = input.required<readonly MapAttack[]>();
  readonly label = input.required<string>();
  readonly summary = input.required<string>();

  protected readonly factions = FACTIONS;
  // Full class names, so Tailwind finds them in the source.
  protected readonly fills = {
    lonestar: 'fill-lonestar',
    valkyra: 'fill-valkyra',
    manticore: 'fill-manticore',
  } as const;
  protected readonly strokes = {
    lonestar: 'stroke-lonestar',
    valkyra: 'stroke-valkyra',
    manticore: 'stroke-manticore',
  } as const;

  private readonly attackBySector = computed(
    () => new Map(this.attacks().map((attack) => [attack.sectorId, attack])),
  );

  protected readonly viewBox = computed(() => viewBoxFor(this.sectors().map((s) => s.coord)));
  protected readonly hexes = computed(() =>
    this.sectors().map((sector) => {
      const attack = this.attackBySector().get(sector.id);
      return {
        id: sector.id,
        title: attack?.label ?? sector.name,
        owner: sector.owner,
        points: hexPoints(sector.coord),
        pattern: patternOf(sector.owner),
        underAttack: attack !== undefined,
      };
    }),
  );
  protected readonly hexesUnderAttack = computed(() =>
    this.hexes().filter((hex) => hex.underAttack),
  );
  protected readonly arrows = computed(() =>
    this.attacks().flatMap((attack) => {
      const arrow = attackArrow(this.sectors(), attack);
      return arrow ? [{ ...arrow, sectorId: attack.sectorId, attacker: attack.attacker }] : [];
    }),
  );
}
