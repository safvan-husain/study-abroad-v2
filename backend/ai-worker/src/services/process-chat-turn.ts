import type { ChatMessage } from '@study-abroad/contracts';
import type { AgentClient } from './agent-server-client.js';
import type { WorkerMessageStore } from './mongo-message-store.js';

export interface Coordinator {
  claim(turnId: string, workerId: string): Promise<boolean>;
  renew?(turnId: string, workerId: string, leaseSeconds: number): Promise<boolean>;
  complete(turnId: string, result: Record<string, string>): Promise<void>;
  retry(turnId: string, errorCode: string): Promise<void>;
  fail?(turnId: string, errorCode: string): Promise<void>;
}
export interface ChatTurn { conversationId: string; turnId: string; correlationId: string; workerId: string; }
export async function processChatTurn(turn: ChatTurn, store: WorkerMessageStore, agent: AgentClient, coordinator: Coordinator): Promise<void> {
  let claimed = false;
  try { claimed = await coordinator.claim(turn.turnId, turn.workerId); } catch { return; }
  if (!claimed) return;
  try {
    const history = await store.list(turn.conversationId);
    const turnUsers = history.filter(message => message.role === 'user' && message.turnId === turn.turnId);
    if (turnUsers.length !== 1) throw new Error(turnUsers.length === 0 ? 'turn has no user message' : 'turn has multiple user messages');
    const result = await agent.run([turnUsers[0]], turn);
    const assistant: ChatMessage = await store.append({ messageId: `${turn.turnId}-assistant`, conversationId: turn.conversationId, turnId: turn.turnId, role: 'assistant', content: result.content, idempotencyKey: `${turn.turnId}-assistant` });
    await coordinator.complete(turn.turnId, { status: 'completed', messageId: assistant.messageId, agentThreadId: result.threadId, runId: result.runId, correlationId: turn.correlationId });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'worker_error';
    const errorCode = error instanceof Error ? error.name : 'worker_error';
    const permanent = message.includes('no user message') || message.includes('multiple user messages') || message.includes('Invalid thread ID') || message.includes('must be a UUID');
    if (permanent && coordinator.fail) await coordinator.fail(turn.turnId, errorCode);
    else await coordinator.retry(turn.turnId, errorCode);
  }
}
