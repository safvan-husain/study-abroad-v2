export { loadConfig } from './config.js';
export { JobWorker } from './services/job-worker.js';
export { AgentServerClient } from './services/agent-server-client.js';
export { processChatTurn } from './services/process-chat-turn.js';
export { SpacetimeCoordinatorAdapter } from './services/coordinator-adapter.js';
export { type Coordinator, type ChatTurn } from './services/process-chat-turn.js';

import { loadConfig } from './config.js';
import { AgentServerClient } from './services/agent-server-client.js';
import { JobWorker } from './services/job-worker.js';
import type { Coordinator } from './services/process-chat-turn.js';
import type { PendingJobSource } from './services/coordinator-adapter.js';

export function createWorker(deps: { coordinator: Coordinator; jobs?: PendingJobSource }, config = loadConfig()) {
  return new JobWorker({ ...deps, agent: new AgentServerClient(config), leaseSeconds: config.WORKER_LEASE_SECONDS, poll: deps.jobs?.poll, subscribe: deps.jobs?.subscribe });
}

// The host supplies the generated SpacetimeDB connection.
// Keeping this factory injectable makes local tests independent of live services.
export async function startWorker(deps: { coordinator: Coordinator; jobs?: PendingJobSource }) {
  const worker = createWorker(deps);
  worker.start();
  const shutdown = () => void worker.stop();
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  return worker;
}
