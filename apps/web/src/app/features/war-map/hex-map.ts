import { Component, computed, input } from '@angular/core';
import { FACTIONS, type Faction, type Sector, type SectorId } from '@frontline/core';
import { attackArrow } from './attack-arrows';
import { patternOf } from './faction-patterns';
import { frontLine } from './front-line';
import { HEX_SIZE, hexCenter, hexPoints, viewBoxFor } from './hex-layout';

/** A battle as the map shows it; `label` names both sides for the sector's tooltip. */
export interface MapAttack {
  readonly sectorId: SectorId;
  readonly attacker: Faction;
  readonly label: string;
}

/** The horizontal split across a tile, inset from its sides. */
const SPLIT_HALF_WIDTH = HEX_SIZE * 0.72;
const splitOf = (sector: Sector) => {
  const center = hexCenter(sector.coord);
  return { x1: center.x - SPLIT_HALF_WIDTH, x2: center.x + SPLIT_HALF_WIDTH, y: center.y };
};

/**
 * The war map, drawn as flap tiles on the board: one hex per sector in its owner's
 * color and texture, split across the middle like a flap. When a sector changes hands
 * its tile flips to the new owner. The front (every border between factions) is the
 * heaviest line on the board, each battle gets an arrow in the attacker's color from
 * its territory, and sectors under attack pulse in amber. The text alternative is the
 * summary plus the standings and the battle rows next to the map.
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
            <path d="M0,0 L10,5 L0,10 z" [class]="'stroke-table-raised ' + fills[faction]" />
          </marker>
        }
      </defs>
      <!-- Tracked by sector and owner: a conquered sector is a new tile that flips in. -->
      @for (hex of hexes(); track hex.id + hex.owner) {
        <g class="tile" [style.--i]="$index">
          <title>{{ hex.title }}</title>
          <polygon
            [attr.points]="hex.points"
            [class]="'stroke-table-raised ' + fills[hex.owner]"
            stroke-width="1.6"
          />
          <polygon [attr.points]="hex.points" [attr.fill]="hex.pattern" />
          <line
            [attr.x1]="hex.split.x1"
            [attr.x2]="hex.split.x2"
            [attr.y1]="hex.split.y"
            [attr.y2]="hex.split.y"
            class="stroke-table-raised"
            stroke-width="0.6"
          />
        </g>
      }
      <g class="pointer-events-none stroke-chalk" stroke-width="1.4" stroke-linecap="round">
        @for (segment of front(); track $index) {
          <line
            [attr.x1]="segment.from.x"
            [attr.y1]="segment.from.y"
            [attr.x2]="segment.to.x"
            [attr.y2]="segment.to.y"
          />
        }
      </g>
      <!-- Drawn last, so no neighbouring hex covers the outline of a sector under attack. -->
      @for (hex of hexesUnderAttack(); track hex.id) {
        <polygon
          [attr.points]="hex.points"
          class="front-pulse pointer-events-none fill-none stroke-signal"
          stroke-width="1.6"
        />
      }
      @for (arrow of arrows(); track arrow.sectorId) {
        <g class="pointer-events-none" stroke-linecap="round">
          <line
            [attr.x1]="arrow.from.x"
            [attr.y1]="arrow.from.y"
            [attr.x2]="arrow.to.x"
            [attr.y2]="arrow.to.y"
            class="stroke-table-raised"
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
    .tile {
      transform-box: fill-box;
      transform-origin: center;
      animation: tile-flip 360ms var(--ease-out) both;
      animation-delay: calc(var(--i) * 12ms);
    }
    @keyframes tile-flip {
      from {
        transform: scaleY(0.08);
        opacity: 0.3;
      }
    }
    .front-pulse {
      animation: front-pulse 1.8s ease-in-out infinite;
    }
    @keyframes front-pulse {
      50% {
        stroke-opacity: 0.3;
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
        split: splitOf(sector),
        pattern: patternOf(sector.owner),
        underAttack: attack !== undefined,
      };
    }),
  );

  protected readonly front = computed(() => frontLine(this.sectors()));

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
