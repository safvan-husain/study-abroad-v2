import type { Run } from "langsmith";
import { describe, expect, it } from "vitest";

import { createCloneMetadata, studioUrl, threadRunsToSupersteps } from "../scripts/clone-langsmith-thread.js";

function run(value: Partial<Run> & Pick<Run, "id" | "name">): Run {
  return value as Run;
}

describe("threadRunsToSupersteps", () => {
  it("reconstructs every turn in checkpoint order", () => {
    const roots = [
      run({ id: "turn-1", name: "LangGraph", start_time: "2026-01-01T00:00:00Z" }),
      run({ id: "turn-2", name: "LangGraph", start_time: "2026-01-01T00:00:01Z" }),
    ];
    const children = [
      run({
        id: "node-2",
        name: "process_input",
        parent_run_id: "turn-2",
        outputs: { runCount: 1, output: "run-2" },
        extra: { metadata: { langgraph_node: "process_input", langgraph_step: 4 } },
      }),
      run({
        id: "start-1",
        name: "__start__",
        parent_run_id: "turn-1",
        outputs: { input: "hello" },
        extra: { metadata: { langgraph_node: "__start__", langgraph_step: 0 } },
      }),
      run({
        id: "node-1",
        name: "process_input",
        parent_run_id: "turn-1",
        outputs: { runCount: 1, output: "run-1" },
        extra: { metadata: { langgraph_node: "process_input", langgraph_step: 1 } },
      }),
      run({
        id: "start-2",
        name: "__start__",
        parent_run_id: "turn-2",
        outputs: { input: "hello" },
        extra: { metadata: { langgraph_node: "__start__", langgraph_step: 3 } },
      }),
    ];

    expect(threadRunsToSupersteps(roots, children)).toEqual({
      nodeNames: ["process_input"],
      supersteps: [
        { updates: [{ values: {}, asNode: "__input__" }] },
        { updates: [{ values: { input: "hello" }, asNode: "__start__" }] },
        { updates: [{ values: { runCount: 1, output: "run-1" }, asNode: "process_input" }] },
        { updates: [{ values: { input: "hello" }, asNode: "__start__" }] },
        { updates: [{ values: { runCount: 1, output: "run-2" }, asNode: "process_input" }] },
      ],
    });
  });

  it("preserves clone provenance and builds an Agent Studio URL", () => {
    expect(createCloneMetadata("source-thread", "project", 2)).toEqual({
      clone_source: "langsmith_thread",
      source_thread_id: "source-thread",
      source_project: "project",
      source_turn_count: 2,
    });

    const url = new URL(studioUrl("http://localhost:2024", "agent", "clone-thread", "org-1"));
    expect(url.pathname).toBe("/o/org-1/studio/thread");
    expect(url.searchParams.get("baseUrl")).toBe("http://localhost:2024");
    expect(url.searchParams.get("assistantId")).toBe("agent");
    expect(url.searchParams.get("threadId")).toBe("clone-thread");
    expect(url.searchParams.get("mode")).toBe("graph");
  });
});
