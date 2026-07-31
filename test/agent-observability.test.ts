import { describe, expect, it } from "vitest";

import { loadSmokeTestConfig, runObservabilitySmoke } from "../scripts/agent-observability.js";

describe("Agent Server observability contract", () => {
  it("reuses a thread, returns distinct run IDs, and preserves deterministic state", async () => {
    const previousTracing = process.env.LANGSMITH_TRACING;
    process.env.LANGSMITH_TRACING = "false";

    try {
      const config = loadSmokeTestConfig();
      const evidence = await runObservabilitySmoke();

      expect(evidence.threadId).toMatch(/^[0-9a-f-]{36}$/);
      expect(evidence.first.runId).toMatch(/^[0-9a-f-]{36}$/);
      expect(evidence.second.runId).toMatch(/^[0-9a-f-]{36}$/);
      expect(evidence.second.runId).not.toBe(evidence.first.runId);
      expect(evidence.first.output).toMatchObject({
        input: "local-observability",
        output: "processed:local-observability:run-1",
        runCount: 1,
      });
      expect(evidence.second.output).toMatchObject({
        input: "local-observability",
        output: "processed:local-observability:run-2",
        runCount: 2,
      });
      expect(evidence.state).toMatchObject({
        input: "local-observability",
        output: "processed:local-observability:run-2",
        runCount: 2,
      });
      const expectedCorrelationMetadata = {
        correlation_id: evidence.metadata.correlation_id,
        phase: evidence.metadata.phase,
        langsmith_project: evidence.metadata.langsmith_project,
        thread_id: evidence.threadId,
      };
      expect(evidence.threadMetadata).toMatchObject(expectedCorrelationMetadata);
      expect(evidence.first.metadata).toMatchObject(expectedCorrelationMetadata);
      expect(evidence.second.metadata).toMatchObject(expectedCorrelationMetadata);
      expect(evidence.metadata).toMatchObject({
        graph_id: config.smokeTestGraphId,
        phase: "phase-1-agent-observability",
        langsmith_project: config.langSmithProject,
        thread_id: evidence.threadId,
      });
      expect(evidence.metadata.correlation_id).toMatch(/^phase-1-/);
      expect(evidence.metadata.thread_id).toBe(evidence.threadId);
      expect(evidence.externalThreadRunIds).toEqual([]);
      expect(evidence.externalTrace).toBe("not_configured");
    } finally {
      if (previousTracing === undefined) delete process.env.LANGSMITH_TRACING;
      else process.env.LANGSMITH_TRACING = previousTracing;
    }
  });

  it("rejects LangSmith tracing without credentials", () => {
    const previousKey = process.env.LANGSMITH_API_KEY;
    const previousLangChainKey = process.env.LANGCHAIN_API_KEY;
    const previousTracing = process.env.LANGSMITH_TRACING;

    process.env.LANGSMITH_TRACING = "true";
    process.env.LANGSMITH_API_KEY = "";
    process.env.LANGCHAIN_API_KEY = "";

    expect(() => loadSmokeTestConfig()).toThrow(/LANGSMITH_API_KEY/);

    if (previousKey === undefined) delete process.env.LANGSMITH_API_KEY;
    else process.env.LANGSMITH_API_KEY = previousKey;
    if (previousLangChainKey === undefined) delete process.env.LANGCHAIN_API_KEY;
    else process.env.LANGCHAIN_API_KEY = previousLangChainKey;
    if (previousTracing === undefined) delete process.env.LANGSMITH_TRACING;
    else process.env.LANGSMITH_TRACING = previousTracing;
  });
});
