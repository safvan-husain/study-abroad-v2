import { randomUUID } from "node:crypto";
import { Client } from "@langchain/langgraph-sdk";
import dotenv from "dotenv";

dotenv.config({ path: new URL("../.env", import.meta.url), quiet: true });

export interface ChatSmokeResult {
  conversationId: string;
  threadId: string;
  assistantId: string;
  runIds: string[];
  messages: Array<Record<string, unknown>>;
}

export async function runChatSmoke(): Promise<ChatSmokeResult> {
  const agentUrl = process.env.AGENT_SERVER_URL ?? "http://localhost:2024";
  const graphId = process.env.SMOKE_TEST_GRAPH_ID ?? "agent";
  const conversationId = randomUUID();
  const client = new Client({ apiUrl: agentUrl });
  const assistant = await client.assistants.create({ graphId, name: `chat-smoke-${conversationId}` });
  const thread = await client.threads.create({
    threadId: conversationId,
    metadata: { thread_id: conversationId, conversation_id: conversationId },
  });
  if (thread.thread_id !== conversationId) {
    throw new Error(`Agent Server returned thread ${thread.thread_id}, expected ${conversationId}`);
  }

  const messages: Array<Record<string, unknown>> = [];
  const runIds: string[] = [];

  for (const content of ["Hello", "What did I say first?"]) {
    messages.push({ id: randomUUID(), role: "user", content, conversationId, createdAt: new Date().toISOString() });
    let runId: string | undefined;
    const output = (await client.runs.wait(thread.thread_id, assistant.assistant_id, {
      input: { conversationId, messages },
      metadata: { thread_id: conversationId, conversation_id: conversationId, phase: "phase-2-multi-turn-chat" },
      multitaskStrategy: "reject",
      onRunCreated: (run) => {
        runId = run.run_id;
      },
    })) as { messages?: Array<Record<string, unknown>>; turn?: number };
    if (!runId) throw new Error("Agent Server did not return a run ID for the chat turn.");
    runIds.push(runId);
    messages.splice(0, messages.length, ...(output.messages ?? messages));
    if (output.turn !== messages.filter((message) => message.role === "assistant").length) {
      throw new Error("Inconsistent conversation turn.");
    }
  }

  return { conversationId, threadId: thread.thread_id, assistantId: assistant.assistant_id, runIds, messages };
}

async function main() {
  console.log(JSON.stringify(await runChatSmoke(), null, 2));
}

const invokedScript = process.argv[1] && new URL(`file://${process.argv[1]}`).href === import.meta.url;
if (invokedScript) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
