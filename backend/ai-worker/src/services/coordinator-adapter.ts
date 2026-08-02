import type { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { Coordinator, ChatTurn, TurnCompletion } from './process-chat-turn.js';
import type { WorkItemCoordinator, WorkspaceWorkItem } from './process-work-item.js';

export interface PendingJobSource {
  subscribe(callback: (turn: ChatTurn) => void): () => void;
  poll(): Promise<ChatTurn[]>;
}

export interface PendingWorkItemSource {
  subscribe(callback: (item: WorkspaceWorkItem) => void): () => void;
  poll(): Promise<WorkspaceWorkItem[]>;
}

type ReducerArgs = Record<string, unknown>;
type CoordinatorConnection = { reducers: Record<string, unknown>; db: unknown };

/** Production boundary over generated SpacetimeDB accessors and an explicit job source. */
export class SpacetimeCoordinatorAdapter implements Coordinator, WorkItemCoordinator {
  constructor(
    private readonly connection: CoordinatorConnection,
    private readonly jobs: PendingJobSource,
    private readonly workItems?: PendingWorkItemSource,
    private readonly leaseSeconds = 60,
  ) {}
  pendingJobs() { return this.jobs; }
  pendingWorkItems() { return this.workItems; }
  private reducer(name: 'claim' | 'renew' | 'completeTurn' | 'retry' | 'fail' | 'claimWorkItem' | 'renewWorkItem' | 'completeWorkItem' | 'retryWorkItem' | 'failWorkItem') {
    const reducer = this.connection.reducers[name] as ((args: ReducerArgs) => Promise<unknown>) | undefined;
    if (!reducer) throw new Error(`SpacetimeDB reducer is unavailable: ${name}`);
    return reducer;
  }
  // The reducer derives ownership from the authenticated SpacetimeDB caller.
  async claim(turn: ChatTurn) {
    await this.reducer('claim')({ turnId: turn.turnId, expectedAttempt: turn.attempt, leaseSeconds: BigInt(this.leaseSeconds) });
    return turn.attempt + 1;
  }
  async renew(turnId: string, attempt: number, leaseSeconds = this.leaseSeconds) {
    await this.reducer('renew')({ turnId, attempt, leaseSeconds: BigInt(leaseSeconds) });
  }
  async complete(turnId: string, attempt: number, completion: TurnCompletion) {
    await this.reducer('completeTurn')({ turnId, attempt, ...completion });
  }
  async retry(turnId: string, attempt: number, errorCode: string) {
    await this.reducer('retry')({ turnId, attempt, errorCode });
  }
  async fail(turnId: string, attempt: number, errorCode: string) {
    await this.reducer('fail')({ turnId, attempt, errorCode });
  }
  async claimWorkItem(item: WorkspaceWorkItem) {
    await this.reducer('claimWorkItem')({ workItemId: item.workItemId, expectedAttempt: item.attempt, leaseSeconds: BigInt(this.leaseSeconds) });
    return item.attempt + 1;
  }
  async renewWorkItem(workItemId: string, attempt: number, leaseSeconds = this.leaseSeconds) {
    await this.reducer('renewWorkItem')({ workItemId, attempt, leaseSeconds: BigInt(leaseSeconds) });
  }
  async completeWorkItem(workItemId: string, attempt: number, resultJson: string, runId?: string) {
    await this.reducer('completeWorkItem')({ workItemId, attempt, resultJson, runId });
  }
  async retryWorkItem(workItemId: string, attempt: number, errorCode: string) {
    await this.reducer('retryWorkItem')({ workItemId, attempt, errorCode });
  }
  async failWorkItem(workItemId: string, attempt: number, errorCode: string) {
    await this.reducer('failWorkItem')({ workItemId, attempt, errorCode });
  }
}
