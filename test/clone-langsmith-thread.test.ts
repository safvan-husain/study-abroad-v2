import type { Run } from "langsmith";
import { describe, expect, it } from "vitest";

import { threadRunsToSupersteps } from "../scripts/clone-langsmith-thread.js";

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
});
