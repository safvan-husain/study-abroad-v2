import { InMemoryMongoMessageStore } from '../backend/ai-worker/src/services/mongo-message-store.js';
import { JobWorker } from '../backend/ai-worker/src/services/job-worker.js';
import { AgentServerClient } from '../backend/ai-worker/src/services/agent-server-client.js';

const store = new InMemoryMongoMessageStore();
await store.append({ messageId: 'smoke-user', conversationId: 'smoke-conversation', turnId: 'smoke-turn', role: 'user', content: 'Hello worker', idempotencyKey: 'smoke-user' });
const result: Record<string, string> = {};
const sdk = { assistants: { create: async () => ({ assistant_id: 'smoke-assistant' }) }, threads: { create: async () => ({}) }, runs: { wait: async (_thread: string, _assistant: string, options: any) => { options.onRunCreated({ run_id: 'smoke-run' }); return { messages: [{ type: 'ai', content: 'Hello from worker' }] }; } } } as any;
const agent = new AgentServerClient({ AGENT_SERVER_URL: 'http://smoke', AGENT_GRAPH_ID: 'chat' } as any, sdk);
const coordinator = { claim: async () => true, complete: async (_: string, value: Record<string, string>) => Object.assign(result, value), retry: async () => { throw new Error('smoke failed'); } };
const worker = new JobWorker({ store, agent, coordinator });
worker.start();
await worker.handle({ conversationId: 'smoke-conversation', turnId: 'smoke-turn', correlationId: 'smoke-correlation', workerId: 'smoke-worker' });
await worker.stop();
if ((await store.list('smoke-conversation')).length !== 2 || result.status !== 'completed') throw new Error('worker smoke failed');
console.log(JSON.stringify({ result, messages: await store.list('smoke-conversation') }, null, 2));
