import { GAME_CONFIG, type WarPace } from '../../config/game';
import type { Clock, IdGenerator, TransactionRunner } from '../../shared/application/ports';
import { FACTIONS, type Faction } from '../../shared/domain/faction';
import type { AllegianceChanged, MatchApproved } from '../../shared/domain/integration-events';
import type { PlayerId } from '../../shared/domain/player-id';
import { err, ok, type Result } from '../../shared/domain/result';
import {
  openBattle,
  resolveBattle,
  scoreMatch,
  type BattleId,
  type OpenBattle,
} from '../domain/battle';
import {
  castVote,
  openVoteRound,
  tallyVotes,
  withdrawVote,
  type OpenVoteRound,
  type VoteError,
  type VoteRoundId,
} from '../domain/vote-round';
import type { Sector, SectorId } from '../domain/war-map';
import type { WarTransactionContext } from './ports';

interface WarDeps {
  readonly transaction: TransactionRunner<WarTransactionContext>;
  readonly clock: Clock;
  readonly ids: IdGenerator;
  /** Standard by default; the dev demo runs faster. */
  readonly pace?: WarPace;
}

const sectorsUnderAttack = (battles: readonly OpenBattle[]): ReadonlySet<SectorId> =>
  new Set(battles.map((battle) => battle.sectorId));

const newRound = (
  { ids, pace = GAME_CONFIG.pace.standard }: Pick<WarDeps, 'ids' | 'pace'>,
  faction: Faction,
  opensAt: Date,
): OpenVoteRound =>
  openVoteRound({
    id: ids.next() as VoteRoundId,
    faction,
    opensAt,
    durationHours: pace.voteRoundHours,
  });

/** Stores the season map and opens the first vote round of every faction. */
export const startWar =
  ({ transaction, clock, ...deps }: WarDeps) =>
  (command: {
    sectors: readonly Sector[];
  }): Promise<Result<void, 'war-already-started' | 'empty-map'>> =>
    transaction.run(async ({ map, rounds }) => {
      if ((await map.load()) !== null) return err('war-already-started');
      if (command.sectors.length === 0) return err('empty-map');

      await map.save(command.sectors);
      for (const faction of FACTIONS) await rounds.save(newRound(deps, faction, clock.now()));
      return ok(undefined);
    });

/** `voterFaction` comes from the verified player (custom claims), never from the client. */
export const castVoteInRound =
  ({ transaction, clock }: Pick<WarDeps, 'transaction' | 'clock'>) =>
  (command: {
    playerId: PlayerId;
    voterFaction: Faction;
    sectorId: SectorId;
  }): Promise<Result<OpenVoteRound, VoteError | 'no-open-round' | 'war-not-started'>> =>
    transaction.run(async ({ map, rounds, battles }) => {
      const sectors = await map.load();
      if (sectors === null) return err('war-not-started');

      const round = (await rounds.findOpen()).find((r) => r.faction === command.voterFaction);
      if (!round) return err('no-open-round');

      const voted = castVote(round, sectors, sectorsUnderAttack(await battles.findOpen()), {
        ...command,
        castAt: clock.now(),
      });
      if (voted.ok) await rounds.save(voted.value);
      return voted;
    });

/** Reacts to AllegianceChanged: nobody may vote for two factions in the same round. */
export const withdrawVoteOnAllegianceChange =
  ({ transaction }: Pick<WarDeps, 'transaction'>) =>
  (event: AllegianceChanged): Promise<void> =>
    transaction.run(async ({ rounds }) => {
      const round = (await rounds.findOpen()).find((r) => r.faction === event.from);
      if (round) await rounds.save(withdrawVote(round, event.playerId));
    });

/** Reacts to MatchApproved: adds the match to every open battle it was played in. */
export const scoreApprovedMatch =
  ({ transaction }: Pick<WarDeps, 'transaction'>) =>
  (event: MatchApproved): Promise<void> =>
    transaction.run(async ({ battles }) => {
      for (const battle of await battles.findOpen()) {
        const scored = scoreMatch(battle, event);
        // Idempotent: a report already counted leaves the battle unchanged.
        if (scored.ok && scored.value !== battle) await battles.save(scored.value);
      }
    });

const byFactionOrder = (a: OpenVoteRound, b: OpenVoteRound): number =>
  a.closesAt.getTime() - b.closesAt.getTime() ||
  FACTIONS.indexOf(a.faction) - FACTIONS.indexOf(b.faction);

const withOwner = (sectors: readonly Sector[], sectorId: SectorId, owner: Faction): Sector[] =>
  sectors.map((sector) => (sector.id === sectorId ? { ...sector, owner } : sector));

/**
 * Scheduled job. First resolves the battles that have ended (updating the map), then
 * closes the vote rounds that have ended (opening battles or new rounds). Each phase
 * starts at the scheduled end of the previous one, so a late run keeps the rhythm.
 *
 * Firestore transactions require every read to happen before any write, so all the
 * state is loaded up front and rounds opened during this run are tracked in memory.
 */
export const advanceWar =
  ({ transaction, clock, ids, pace = GAME_CONFIG.pace.standard }: WarDeps) =>
  (): Promise<{ resolvedBattles: number; closedRounds: number }> =>
    transaction.run(async ({ map, rounds, battles }) => {
      const now = clock.now();
      const [loadedMap, openBattles, openRounds] = await Promise.all([
        map.load(),
        battles.findOpen(),
        rounds.findOpen(),
      ]);
      if (loadedMap === null) return { resolvedBattles: 0, closedRounds: 0 };

      let sectors = loadedMap;
      const activeBattles: OpenBattle[] = [];
      const roundsToClose = [...openRounds];
      let resolvedBattles = 0;
      for (const battle of openBattles) {
        const resolved = resolveBattle(battle, now);
        if (!resolved.ok) {
          activeBattles.push(battle);
          continue;
        }
        await battles.save(resolved.value);
        if (resolved.value.conquered) {
          sectors = withOwner(sectors, battle.sectorId, battle.attacker);
        }
        const nextRound = newRound({ ids, pace }, battle.attacker, battle.endsAt);
        await rounds.save(nextRound);
        roundsToClose.push(nextRound); // may already be due if the job ran very late
        resolvedBattles += 1;
      }

      let closedRounds = 0;
      for (const round of roundsToClose.sort(byFactionOrder)) {
        const closed = tallyVotes(round, {
          now,
          map: sectors,
          underAttack: sectorsUnderAttack(activeBattles),
        });
        if (!closed.ok) continue;
        await rounds.save(closed.value);
        closedRounds += 1;

        const { outcome } = closed.value;
        const target =
          outcome.kind === 'attack' ? sectors.find((s) => s.id === outcome.sectorId) : undefined;
        const battle = target
          ? openBattle({
              id: ids.next() as BattleId,
              sector: target,
              attacker: round.faction,
              startsAt: round.closesAt,
              durationHours: pace.battleHours,
            })
          : undefined;

        if (battle?.ok) {
          await battles.save(battle.value);
          activeBattles.push(battle.value);
        } else {
          await rounds.save(newRound({ ids, pace }, round.faction, round.closesAt));
        }
      }

      if (resolvedBattles > 0) await map.save(sectors);
      return { resolvedBattles, closedRounds };
    });
