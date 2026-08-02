import type { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { DiscoveryProfilePatch, TurnUpdatePayload } from '@study-abroad/contracts';
import type { Coordinator, ChatTurn, TurnCompletion, CatalogStore } from './process-chat-turn.js';
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
export class SpacetimeCoordinatorAdapter implements Coordinator, WorkItemCoordinator, CatalogStore {
  constructor(
    private readonly connection: CoordinatorConnection,
    private readonly jobs: PendingJobSource,
    private readonly workItems?: PendingWorkItemSource,
    private readonly leaseSeconds = 60,
  ) {}
  pendingJobs() { return this.jobs; }
  pendingWorkItems() { return this.workItems; }
  private reducer(name: string) {
    const reducer = this.connection.reducers[name] as ((args: ReducerArgs) => Promise<unknown>) | undefined;
    if (!reducer) throw new Error(`SpacetimeDB reducer is unavailable: ${name}`);
    return reducer;
  }
  listCourses() {
    const table = (this.connection.db as { catalog_course?: { iter: () => Iterable<Record<string, unknown>> } }).catalog_course;
    if (!table) return [];
    return [...table.iter()]
      .filter((row) => row.active !== false)
      .map((row) => ({
        courseId: String(row.courseId ?? ''),
        institutionId: String(row.institutionId ?? ''),
        institutionName: String(row.institutionName ?? ''),
        country: String(row.country ?? ''),
        city: String(row.city ?? ''),
        name: String(row.name ?? ''),
        area: String(row.area ?? ''),
        level: String(row.level ?? ''),
        tuitionBand: String(row.tuitionBand ?? ''),
        englishBar: String(row.englishBar ?? ''),
      }));
  }
  getProfile(conversationId: string): DiscoveryProfilePatch | undefined {
    const table = (this.connection.db as { worker_conversation_profiles?: { iter: () => Iterable<Record<string, unknown>> } }).worker_conversation_profiles;
    if (!table) return undefined;
    const row = [...table.iter()].find((entry) => String(entry.conversationId) === conversationId);
    if (!row) return undefined;
    let candidateAreas: string[] = [];
    try {
      candidateAreas = JSON.parse(String(row.candidateAreasJson ?? '[]')) as string[];
    } catch {
      candidateAreas = [];
    }
    return {
      background: String(row.background ?? ''),
      courseInterests: String(row.courseInterests ?? ''),
      ambitions: String(row.ambitions ?? ''),
      primaryArea: String(row.primaryArea ?? ''),
      candidateAreas,
      studentPhrase: String(row.studentPhrase ?? ''),
      constraintsText: String(row.constraintsText ?? ''),
    };
  }
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
  async publishTurnUpdate(turnId: string, attempt: number, sequence: number, payload: TurnUpdatePayload) {
    await this.reducer('publishTurnUpdate')({
      turnId,
      attempt,
      sequence,
      kind: payload.kind,
      payloadJson: JSON.stringify(payload),
    });
  }
  async upsertConversationProfile(conversationId: string, profile: DiscoveryProfilePatch) {
    await this.reducer('upsertConversationProfile')({
      conversationId,
      background: profile.background,
      courseInterests: profile.courseInterests,
      ambitions: profile.ambitions,
      primaryArea: profile.primaryArea,
      candidateAreasJson: JSON.stringify(profile.candidateAreas),
      studentPhrase: profile.studentPhrase,
      constraintsText: profile.constraintsText,
    });
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

export type { DbConnection };
