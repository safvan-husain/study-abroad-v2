import { Client } from '@langchain/langgraph-sdk';
import type { ChatMessage } from '@study-abroad/contracts';
import type { WorkerConfig } from '../config.js';

export interface AgentTurnResult { threadId: string; runId: string; content: string; metadata: Record<string, string>; }
export interface AgentClient { run(input: ChatMessage[], ids: { conversationId: string; turnId: string; correlationId: string }): Promise<AgentTurnResult>; }

export class AgentServerClient implements AgentClient {
  private readonly client: Client;
  private readonly assistants = new Map<string, string>();
  constructor(private readonly config: WorkerConfig, client = new Client({ apiUrl: config.AGENT_SERVER_URL })) { this.client = client; }
  async run(messages: ChatMessage[], ids: { conversationId: string; turnId: string; correlationId: string }): Promise<AgentTurnResult> {
    const assistantId = this.assistants.get(this.config.AGENT_GRAPH_ID) ?? (await this.client.assistants.create({ graphId: this.config.AGENT_GRAPH_ID })).assistant_id;
    this.assistants.set(this.config.AGENT_GRAPH_ID, assistantId);
    await this.client.threads.create({ threadId: ids.conversationId, metadata: { thread_id: ids.conversationId, conversation_id: ids.conversationId }, ifExists: 'do_nothing' });
    let runId: string | undefined;
    const metadata = { thread_id: ids.conversationId, conversation_id: ids.conversationId, turn_id: ids.turnId, correlation_id: ids.correlationId };
    const input = messages.slice(-1).map(({ content }) => ({ role: 'human', content }));
    const output = await this.client.runs.wait(ids.conversationId, assistantId, { input: { messages: input }, metadata, multitaskStrategy: 'reject', onRunCreated: run => { runId = run.run_id; } }) as { messages?: Array<{ role?: string; type?: string; content?: string }> };
    const last = [...(output.messages ?? [])].reverse().find(message => message.role === 'ai' || message.type === 'ai');
    if (!runId || !last?.content) throw new Error('Agent Server returned no run or assistant message');
    return { threadId: ids.conversationId, runId, content: last.content, metadata };
  }
}
