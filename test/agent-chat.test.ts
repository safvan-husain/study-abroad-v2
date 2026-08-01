import { describe, expect, it } from "vitest";
import { runChatSmoke } from "../scripts/agent-chat-smoke.js";

describe("conversational graph", () => {
  it("runs two structured turns through Agent Server on one stable thread", async () => {
    const result = await runChatSmoke();

    expect(result.threadId).toBe(result.conversationId);
    expect(result.runIds).toHaveLength(2);
    expect(new Set(result.runIds).size).toBe(2);
    expect(result.metadata.thread_id).toBe(result.conversationId);
    expect(result.messages.map((item) => item.type ?? item.role)).toEqual(["human", "ai", "human", "ai"]);
    expect(result.messages.map((item) => item.content)).toEqual([
      "Hello",
      "Reference response for turn 1: Hello",
      "What did I say first?",
      "Reference response for turn 2: What did I say first?",
    ]);
  });
});
