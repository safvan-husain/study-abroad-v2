import type { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { Coordinator, ChatTurn } from './process-chat-turn.js';

export interface PendingJobSource {
  subscribe(callback: (turn: ChatTurn) => void): () => void;
  poll(): Promise<ChatTurn[]>;
}

type ReducerArgs = Record<string, unknown>;
type CoordinatorConnection = Pick<DbConnection, 'reducers' | 'db'>;

/** Production boundary over generated SpacetimeDB accessors and an explicit job source. */
export class SpacetimeCoordinatorAdapter implements Coordinator {
  constructor(private readonly connection: CoordinatorConnection, private readonly jobs: PendingJobSource, private readonly leaseSeconds = 60) {}
  pendingJobs() { return this.jobs; }
  private reducer(name: 'claim' | 'renew' | 'complete' | 'retry' | 'fail') {
    const reducer = this.connection.reducers[name] as unknown as ((args: ReducerArgs) => Promise<unknown>) | undefined;
    if (!reducer) throw new Error(`SpacetimeDB reducer is unavailable: ${name}`);
    return reducer;
  }
  async claim(turnId: string, workerId: string) { await this.reducer('claim')({ turnId, workerId, leaseSeconds: this.leaseSeconds }); return true; }
  async renew(turnId: string, workerId: string, leaseSeconds = this.leaseSeconds) { await this.reducer('renew')({ turnId, workerId, leaseSeconds }); return true; }
  async complete(turnId: string, result: Record<string, string>) { await this.reducer('complete')({ turnId, runId: result.runId ?? '', result: JSON.stringify(result) }); }
  async retry(turnId: string, errorCode: string) { await this.reducer('retry')({ turnId, result: errorCode }); }
  async fail(turnId: string, errorCode: string) { await this.reducer('fail')({ turnId, result: errorCode }); }
}
