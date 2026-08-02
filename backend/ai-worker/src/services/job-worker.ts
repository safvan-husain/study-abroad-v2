import { processChatTurn, type ChatTurn, type Coordinator } from './process-chat-turn.js';
import type { AgentClient } from './agent-server-client.js';
export class JobWorker {
  private readonly active = new Set<string>();
  private stopped = true;
  private timer?: ReturnType<typeof setInterval>;
  private unsubscribe?: () => void;
  private readonly inFlight = new Map<string, Promise<void>>();
  constructor(private readonly deps: { agent: AgentClient; coordinator: Coordinator; leaseSeconds?: number; poll?: () => Promise<ChatTurn[]>; subscribe?: (callback: (turn: ChatTurn) => void) => (() => void) | void }) {}
  start(intervalMs = 5000) {
    if (!this.stopped) return;
    this.stopped = false;
    this.unsubscribe = this.deps.subscribe?.(turn => void this.handle(turn)) ?? undefined;
    if (this.deps.poll) { this.timer = setInterval(() => void this.recover(), intervalMs); void this.recover(); }
  }
  private async recover() { for (const turn of await this.deps.poll?.() ?? []) void this.handle(turn); }
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
        });
      } finally {
        if (renewer) clearInterval(renewer);
        this.active.delete(turn.turnId);
        this.inFlight.delete(turn.turnId);
      }
    })();
    this.inFlight.set(turn.turnId, work);
    await work;
  }
  async stop() { this.stopped = true; if (this.timer) clearInterval(this.timer); this.unsubscribe?.(); await Promise.all([...this.inFlight.values()]); this.active.clear(); }
}
