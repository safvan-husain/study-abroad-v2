import type { ChatMessage } from '@study-abroad/contracts';
import type { AgentClient } from './agent-server-client.js';

export interface Coordinator {
  claim(turn: ChatTurn): Promise<number | undefined>;
  renew?(turnId: string, attempt: number, leaseSeconds: number): Promise<void>;
  complete(turnId: string, attempt: number, completion: TurnCompletion): Promise<void>;
  retry(turnId: string, attempt: number, errorCode: string): Promise<void>;
  fail?(turnId: string, attempt: number, errorCode: string): Promise<void>;
}
export interface ChatTurn {
  conversationId: string;
  turnId: string;
  correlationId: string;
  agentThreadId: string;
  userMessageId: string;
  userContent: string;
  attempt: number;
  baseUiRevision: bigint;
}
export interface TurnCompletion {
  assistantContent: string;
  runId: string;
  agentThreadId: string;
  directiveSchemaVersion: number;
  directiveUiRevision: bigint;
  directiveType: string;
  directiveAwareness: string;
  workKind: string;
  workItems: WorkItemSpec[];
}
export interface WorkItemSpec {
  entityType: string;
  entityId: string;
  kind: string;
  inputJson: string;
}

export async function processChatTurn(
  turn: ChatTurn,
  agent: AgentClient,
  coordinator: Coordinator,
  onClaimed?: (attempt: number) => void,
): Promise<void> {
  let attempt: number | undefined;
  try { attempt = await coordinator.claim(turn); } catch { return; }
  if (attempt === undefined) return;
  onClaimed?.(attempt);
  try {
    const userMessage: ChatMessage = {
      messageId: turn.userMessageId,
      conversationId: turn.conversationId,
      turnId: turn.turnId,
      role: 'user',
      content: turn.userContent,
      createdAt: new Date().toISOString(),
    };
    const result = await agent.run([userMessage], turn);
    await coordinator.complete(turn.turnId, attempt, {
      assistantContent: 'I have opened a planning space so we can shape your study-abroad direction together.',
      runId: result.runId,
      agentThreadId: result.threadId,
      directiveSchemaVersion: 1,
      directiveUiRevision: turn.baseUiRevision + 1n,
      directiveType: 'discovery',
      directiveAwareness: 'I am ready to learn about your study-abroad goals.',
      workKind: 'discovery_guidance',
      workItems: [
        {
          entityType: 'discovery_topic',
          entityId: 'academic-background',
          kind: 'advisor_prompt',
          inputJson: JSON.stringify({
            title: 'Academic starting point',
            detail: 'Share your current qualification, subject area, and recent grades.',
          }),
        },
        {
          entityType: 'discovery_topic',
          entityId: 'study-ambition',
          kind: 'advisor_prompt',
          inputJson: JSON.stringify({
            title: 'Study ambition',
            detail: 'Tell me which subjects, careers, or destinations you are considering.',
          }),
        },
      ],
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : 'worker_error';
    try {
      await coordinator.retry(turn.turnId, attempt, errorCode);
    } catch {
      // A newer worker may own the turn after a fenced completion is rejected.
    }
  }
}
