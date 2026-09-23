import type { Battle, BattleId, OpenBattle } from '../domain/battle';
import type { OpenVoteRound, VoteRound, VoteRoundId } from '../domain/vote-round';
import type { Sector } from '../domain/war-map';
import type { BattleRepository, VoteRoundRepository, WarMapRepository } from './ports';

/** In-memory adapters for use case tests. */

export class InMemoryWarMapRepository implements WarMapRepository {
  current: readonly Sector[] | null = null;

  load(): Promise<readonly Sector[] | null> {
    return Promise.resolve(this.current);
  }

  save(map: readonly Sector[]): Promise<void> {
    this.current = map;
    return Promise.resolve();
  }
}

export class InMemoryVoteRoundRepository implements VoteRoundRepository {
  private readonly rounds = new Map<VoteRoundId, VoteRound>();

  findOpen(): Promise<OpenVoteRound[]> {
    return Promise.resolve(
      this.all().filter((round): round is OpenVoteRound => round.status === 'open'),
    );
  }

  save(round: VoteRound): Promise<void> {
    this.rounds.set(round.id, round);
    return Promise.resolve();
  }

  all(): VoteRound[] {
    return [...this.rounds.values()];
  }
}

export class InMemoryBattleRepository implements BattleRepository {
  private readonly battles = new Map<BattleId, Battle>();

  findOpen(): Promise<OpenBattle[]> {
    return Promise.resolve(
      this.all().filter((battle): battle is OpenBattle => battle.status === 'open'),
    );
  }

  save(battle: Battle): Promise<void> {
    this.battles.set(battle.id, battle);
    return Promise.resolve();
  }

  all(): Battle[] {
    return [...this.battles.values()];
  }
}
