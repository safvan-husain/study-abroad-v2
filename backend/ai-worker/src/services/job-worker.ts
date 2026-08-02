import { processChatTurn, type ChatTurn, type Coordinator, type CatalogStore } from './process-chat-turn.js';
import type { AgentClient } from './agent-server-client.js';
import { processWorkItem, type WorkItemCoordinator, type WorkspaceWorkItem } from './process-work-item.js';
export class JobWorker {
  private readonly active = new Set<string>();
  private stopped = true;
  private timer?: ReturnType<typeof setInterval>;
  private unsubscribe?: () => void;
  private unsubscribeWorkItems?: () => void;
  private readonly inFlight = new Map<string, Promise<void>>();
  constructor(private readonly deps: {
    agent: AgentClient;
    coordinator: Coordinator & Partial<WorkItemCoordinator> & Partial<CatalogStore>;
    leaseSeconds?: number;
    poll?: () => Promise<ChatTurn[]>;
    subscribe?: (callback: (turn: ChatTurn) => void) => (() => void) | void;
    pollWorkItems?: () => Promise<WorkspaceWorkItem[]>;
    subscribeWorkItems?: (callback: (item: WorkspaceWorkItem) => void) => (() => void) | void;
    catalog?: CatalogStore;
  }) {}
  start(intervalMs = 5000) {
    if (!this.stopped) return;
    this.stopped = false;
    this.unsubscribe = this.deps.subscribe?.(turn => void this.handle(turn)) ?? undefined;
    this.unsubscribeWorkItems = this.deps.subscribeWorkItems?.(item => void this.handleWorkItem(item)) ?? undefined;
    if (this.deps.poll) { this.timer = setInterval(() => void this.recover(), intervalMs); void this.recover(); }
  }
  private async recover() {
    for (const turn of await this.deps.poll?.() ?? []) void this.handle(turn);
    for (const item of await this.deps.pollWorkItems?.() ?? []) void this.handleWorkItem(item);
  }
  async handle(turn: ChatTurn) {
    if (this.stopped || this.active.has(turn.turnId)) return;
    this.active.add(turn.turnId);
    const renewMs = Math.max(250, ((this.deps.leaseSeconds ?? 60) * 1000) / 2);
    let renewer: ReturnType<typeof setInterval> | undefined;
    const work = (async () => {
      try {
        await processChatTurn(turn, this.deps.agent, this.deps.coordinator, (attempt) => {
          if (this.deps.coordinator.renew) {
            renewer = setInterval(() => {
              void this.deps.coordinator.renew!(turn.turnId, attempt, this.deps.leaseSeconds ?? 60).catch(() => undefined);
            }, renewMs);
          }
        }, this.deps.catalog ?? (() => {
          const maybe = this.deps.coordinator as Partial<CatalogStore>;
          return typeof maybe.listCourses === 'function' && typeof maybe.getProfile === 'function'
            ? maybe as CatalogStore
            : undefined;
        })());
      } finally {
        if (renewer) clearInterval(renewer);
        this.active.delete(turn.turnId);
        this.inFlight.delete(turn.turnId);
      }
    })();
    this.inFlight.set(turn.turnId, work);
    await work;
  }
  async handleWorkItem(item: WorkspaceWorkItem) {
    if (!this.deps.coordinator.claimWorkItem || !this.deps.coordinator.completeWorkItem || !this.deps.coordinator.retryWorkItem) return;
    const key = `work:${item.workItemId}`;
    if (this.stopped || this.active.has(key)) return;
    this.active.add(key);
    const renewMs = Math.max(250, ((this.deps.leaseSeconds ?? 60) * 1000) / 2);
    let renewer: ReturnType<typeof setInterval> | undefined;
    const work = (async () => {
      try {
        await processWorkItem(item, this.deps.coordinator as Coordinator & WorkItemCoordinator, (attempt) => {
          if (this.deps.coordinator.renewWorkItem) {
            renewer = setInterval(() => {
              void this.deps.coordinator.renewWorkItem!(item.workItemId, attempt, this.deps.leaseSeconds ?? 60).catch(() => undefined);
            }, renewMs);
          }
        }, this.deps.agent);
      } finally {
        if (renewer) clearInterval(renewer);
        this.active.delete(key);
        this.inFlight.delete(key);
      }
    })();
    this.inFlight.set(key, work);
    await work;
  }
  async stop() { this.stopped = true; if (this.timer) clearInterval(this.timer); this.unsubscribe?.(); this.unsubscribeWorkItems?.(); await Promise.all([...this.inFlight.values()]); this.active.clear(); }
}
