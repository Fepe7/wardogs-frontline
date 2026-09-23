import type { Brand } from '../../shared/domain/brand';
import type { Faction } from '../../shared/domain/faction';
import { err, ok, type Result } from '../../shared/domain/result';
import { areAdjacent, type HexCoord } from './hex-coord';

export type SectorId = Brand<string, 'SectorId'>;

export interface Sector {
  readonly id: SectorId;
  readonly name: string;
  readonly coord: HexCoord;
  readonly owner: Faction;
}

export type AttackError =
  'sector-not-found' | 'own-sector' | 'not-adjacent' | 'sector-under-attack';

const NO_SECTORS: ReadonlySet<SectorId> = new Set();

const bordersTerritoryOf = (map: readonly Sector[], sector: Sector, faction: Faction): boolean =>
  map.some((other) => other.owner === faction && areAdjacent(other.coord, sector.coord));

/**
 * Enemy sectors a faction may attack: those bordering its own territory that are not
 * already in a battle (a sector has at most one battle at a time).
 */
export const attackableSectors = (
  map: readonly Sector[],
  faction: Faction,
  underAttack: ReadonlySet<SectorId> = NO_SECTORS,
): Sector[] =>
  map.filter(
    (sector) =>
      sector.owner !== faction &&
      !underAttack.has(sector.id) &&
      bordersTerritoryOf(map, sector, faction),
  );

export const canAttack = (
  map: readonly Sector[],
  faction: Faction,
  sectorId: SectorId,
  underAttack: ReadonlySet<SectorId> = NO_SECTORS,
): Result<Sector, AttackError> => {
  const target = map.find((sector) => sector.id === sectorId);

  if (!target) return err('sector-not-found');
  if (target.owner === faction) return err('own-sector');
  if (!bordersTerritoryOf(map, target, faction)) return err('not-adjacent');
  if (underAttack.has(target.id)) return err('sector-under-attack');
  return ok(target);
};
