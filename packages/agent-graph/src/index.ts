import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";

import type { ChatMessage } from "./contracts.js";

export const AgentState = Annotation.Root({
  input: Annotation<string>({ default: () => "", reducer: (_current, update) => update }),
  runCount: Annotation<number>({ default: () => 0, reducer: (current, update) => current + update }),
  output: Annotation<string>({ default: () => "", reducer: (_current, update) => update }),
  conversationId: Annotation<string>({
    default: () => "",
    reducer: (_current, update) => update,
  }),
  messages: Annotation<ChatMessage[]>({
    default: () => [],
    reducer: (_current, update) => update,
  }),
  assistantMessage: Annotation<ChatMessage | undefined>({
    default: () => undefined,
    reducer: (_current, update) => update,
  }),
  turn: Annotation<number>({
    default: () => 0,
    reducer: (_current, update) => update,
  }),
});

function processInput(state: typeof AgentState.State) {
  const lastUserMessage = [...state.messages].reverse().find((message) => message.role === "user");
  if (!lastUserMessage && state.input) {
    const nextRunCount = state.runCount + 1;
    return { runCount: 1, output: `processed:${state.input}:run-${nextRunCount}` };
  }
  if (!lastUserMessage) throw new Error("A conversation turn requires at least one user message.");
  const assistantMessage: ChatMessage = {
    id: randomUUID(),
    role: "assistant",
    content: `I heard: ${lastUserMessage.content}`,
    conversationId: state.conversationId,
    createdAt: new Date().toISOString(),
  };

  return {
    assistantMessage,
    messages: [...state.messages, assistantMessage],
    turn: state.turn + 1,
  };
}

export const graph = new StateGraph(AgentState)
  .addNode("process_input", processInput)
  .addEdge(START, "process_input")
  .addEdge("process_input", END)
  .compile();
