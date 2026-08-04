export { loadConfig } from './config.js';
export { JobWorker } from './services/job-worker.js';
export { AgentServerClient } from './services/agent-server-client.js';
export { processChatTurn } from './services/process-chat-turn.js';
export { processWorkItem } from './services/process-work-item.js';
export { SpacetimeCoordinatorAdapter } from './services/coordinator-adapter.js';
export { type Coordinator, type ChatTurn, type CatalogStore } from './services/process-chat-turn.js';

import { loadConfig } from './config.js';
import { AgentServerClient } from './services/agent-server-client.js';
import { JobWorker } from './services/job-worker.js';
import type { CatalogStore, Coordinator } from './services/process-chat-turn.js';
import type { PendingJobSource, PendingWorkItemSource } from './services/coordinator-adapter.js';

// The host supplies the generated SpacetimeDB connection.
// Keeping this factory injectable makes local tests independent of live services.
export function createWorker(deps: { coordinator: Coordinator; jobs?: PendingJobSource; workItems?: PendingWorkItemSource }, config = loadConfig()) {
  const maybeCatalog = deps.coordinator as unknown as Partial<CatalogStore>;
  const catalog = typeof maybeCatalog.listCourses === 'function' && typeof maybeCatalog.getProfile === 'function'
    ? maybeCatalog as CatalogStore
    : undefined;
  return new JobWorker({
    ...deps,
    agent: new AgentServerClient(config),
    leaseSeconds: config.WORKER_LEASE_SECONDS,
    poll: deps.jobs?.poll,
    subscribe: deps.jobs?.subscribe,
    pollWorkItems: deps.workItems?.poll,
    subscribeWorkItems: deps.workItems?.subscribe,
    catalog,
  });
}