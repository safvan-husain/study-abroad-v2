import { Annotation, END, START, StateGraph } from "@langchain/langgraph";

export const AgentState = Annotation.Root({
  input: Annotation<string>({
    default: () => "",
    reducer: (_current, update) => update,
  }),
  runCount: Annotation<number>({
    default: () => 0,
    reducer: (current, update) => current + update,
  }),
  output: Annotation<string>({
    default: () => "",
    reducer: (_current, update) => update,
  }),
});

function processInput(state: typeof AgentState.State) {
  const nextRunCount = state.runCount + 1;

  return {
    runCount: 1,
    output: `processed:${state.input}:run-${nextRunCount}`,
  };
}

export const graph = new StateGraph(AgentState)
  .addNode("process_input", processInput)
  .addEdge(START, "process_input")
  .addEdge("process_input", END)
  .compile();
