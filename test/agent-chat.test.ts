import { describe, expect, it } from "vitest";
import { runChatSmoke } from "../scripts/agent-chat-smoke.js";

describe("conversational graph", () => {
  it("runs two structured turns through Agent Server on one stable thread", async () => {
    const result = await runChatSmoke();

    expect(result.threadId).toBe(result.conversationId);
    expect(result.runIds).toHaveLength(2);
    expect(new Set(result.runIds).size).toBe(2);
    expect(result.messages.map((item) => item.role)).toEqual(["user", "assistant", "user", "assistant"]);
    expect(result.messages.map((item) => item.content)).toEqual([
      "Hello",
      "I heard: Hello",
      "What did I say first?",
      "I heard: What did I say first?",
    ]);
  });
});
