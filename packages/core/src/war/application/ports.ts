import type { Battle, OpenBattle } from '../domain/battle';
import type { OpenVoteRound, VoteRound } from '../domain/vote-round';
import type { Sector } from '../domain/war-map';

/** The current map. Stored as a single document so the whole map costs one read. */
export interface WarMapRepository {
  load(): Promise<readonly Sector[] | null>;
  save(map: readonly Sector[]): Promise<void>;
}

export interface VoteRoundRepository {
  findOpen(): Promise<OpenVoteRound[]>;
  save(round: VoteRound): Promise<void>;
}

export interface BattleRepository {
  findOpen(): Promise<OpenBattle[]>;
  save(battle: Battle): Promise<void>;
}

/** What a war use case can touch inside one transaction. */
export interface WarTransactionContext {
  readonly map: WarMapRepository;
  readonly rounds: VoteRoundRepository;
  readonly battles: BattleRepository;
}
