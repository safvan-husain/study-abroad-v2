import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client as AgentServerClient } from "@langchain/langgraph-sdk";
import dotenv from "dotenv";
import { Client as LangSmithClient, type Run } from "langsmith";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

type StateUpdate = {
  values: Record<string, unknown>;
  asNode: string;
};

type Superstep = {
  updates: StateUpdate[];
};

type Message = Record<string, unknown>;

export interface ExpectedThread {
  transcript: Message[];
  checkpoints: Message[][];
  sourceTurnCount: number;
}

export interface CloneVerification {
  expectedMessageCount: number;
  verifiedMessageCount: number;
  expectedCheckpointCount: number;
  verifiedCheckpointCount: number;
  sourceTurnCount: number;
  provenance: {
    cloneSource: string;
    sourceThreadId: string;
    sourceProject: string;
    sourceTurnCount: number;
  };
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function metadata(run: Run) {
  return record(record(run.extra).metadata);
}

function step(run: Run) {
  const value = metadata(run).langgraph_step;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
}

function node(run: Run) {
  const value = metadata(run).langgraph_node;
  return typeof value === "string" && value ? value : run.name;
}

function messages(value: unknown): Message[] | undefined {
  if (Array.isArray(value)) {
    return value.every((item) => item && typeof item === "object" && !Array.isArray(item))
      ? (value as Message[])
      : undefined;
  }

  const object = record(value);
  if (Array.isArray(object.messages)) return messages(object.messages);
  if (object.input !== undefined) return messages(object.input);
  if (object.output !== undefined) return messages(object.output);
  return undefined;
}

function assistantMessage(value: unknown): Message | undefined {
  const candidate = record(value).assistantMessage;
  return candidate && typeof candidate === "object" && !Array.isArray(candidate)
    ? (candidate as Message)
    : undefined;
}

function orderedRuns(rootRuns: Run[]) {
  return [...rootRuns].sort((left, right) =>
    String(left.start_time ?? left.id).localeCompare(String(right.start_time ?? right.id)),
  );
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonical(entry)]),
    );
  }
  return value;
}

function sameJson(actual: unknown, expected: unknown) {
  return JSON.stringify(canonical(actual)) === JSON.stringify(canonical(expected));
}

function startsWithMessages(messages: Message[], prefix: Message[]) {
  return prefix.length <= messages.length && prefix.every((message, index) => sameJson(message, messages[index]));
}

function assertJsonEqual(context: string, actual: unknown, expected: unknown) {
  if (!sameJson(actual, expected)) {
    throw new Error(
      `${context} mismatch. expected=${JSON.stringify(expected)} actual=${JSON.stringify(actual)}`,
    );
  }
}

function compact(value: unknown): unknown {
  if (Array.isArray(value)) {
    const entries = value.map(compact).filter((entry) => entry !== undefined);
    return entries.length ? entries : undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value)
      .filter(([key]) => key !== "id" && key !== "name")
      .map(([key, entry]) => [key, compact(entry)] as const)
      .filter(([, entry]) => entry !== undefined && entry !== null);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return value;
}

function comparableMessages(value: Message[]) {
  return value.map((message) => {
    const kind = message.type ?? message.role;
    const normalizedKind = kind === "user" ? "human" : kind === "assistant" ? "ai" : kind;
    const normalized: Message = { ...message, type: normalizedKind };
    delete normalized.role;
    return compact(normalized);
  });
}

export function buildExpectedThread(rootRuns: Run[]): ExpectedThread {
  const roots = orderedRuns(rootRuns);
  if (!roots.length) throw new Error("Cannot build an expected thread without LangSmith root runs.");

  const checkpoints: Message[][] = [[]];
  let transcript: Message[] = [];

  for (const [index, run] of roots.entries()) {
    const inputMessages = messages(run.inputs);
    const outputMessages = messages(run.outputs) ??
      (inputMessages && assistantMessage(run.outputs)
        ? [...inputMessages, assistantMessage(run.outputs)!]
        : undefined);

    if (!inputMessages) {
      throw new Error(`LangSmith root run ${run.id} is missing a structured input message list.`);
    }
    if (!outputMessages) {
      throw new Error(`LangSmith root run ${run.id} is missing a structured output message list.`);
    }

    const inputCheckpoint = startsWithMessages(inputMessages, transcript)
      ? inputMessages
      : [...transcript, ...inputMessages];
    checkpoints.push(inputCheckpoint, outputMessages);
    transcript = outputMessages;

    if (index > 0 && outputMessages.length < inputCheckpoint.length) {
      throw new Error(`LangSmith root run ${run.id} returned a transcript shorter than the previous turn.`);
    }
  }

  return {
    transcript,
    checkpoints,
    sourceTurnCount: roots.length,
  };
}

export function verifyClonedThread(options: {
  expected: ExpectedThread;
  sourceThreadId: string;
  projectName: string;
  threadMetadata: unknown;
  stateValues: unknown;
  history: Array<{ values?: unknown }>;
}): CloneVerification {
  const threadMetadata = record(options.threadMetadata);
  const expectedProvenance = createCloneMetadata(
    options.sourceThreadId,
    options.projectName,
    options.expected.sourceTurnCount,
  );

  assertJsonEqual("clone provenance", {
    clone_source: threadMetadata.clone_source,
    source_thread_id: threadMetadata.source_thread_id,
    source_project: threadMetadata.source_project,
    source_turn_count: threadMetadata.source_turn_count,
  }, expectedProvenance);

  const stateMessages = messages(options.stateValues);
  if (!stateMessages) throw new Error("Cloned Agent Server state is missing its messages list.");
  assertJsonEqual(
    "cloned final transcript",
    comparableMessages(stateMessages),
    comparableMessages(options.expected.transcript),
  );

  const historyCheckpoints = options.history.map((checkpoint, index) => {
    const checkpointMessages = messages(checkpoint.values);
    if (!checkpointMessages) {
      throw new Error(`Cloned Agent Server checkpoint ${index} is missing its messages list.`);
    }
    return checkpointMessages;
  }).reverse();

  assertJsonEqual("cloned checkpoint count", historyCheckpoints.length, options.expected.checkpoints.length);
  for (const [index, checkpointMessages] of historyCheckpoints.entries()) {
    assertJsonEqual(
      `cloned checkpoint ${index} messages`,
      comparableMessages(checkpointMessages),
      comparableMessages(options.expected.checkpoints[index]),
    );
  }

  if (historyCheckpoints.length && !sameJson(
    comparableMessages(historyCheckpoints.at(-1)!),
    comparableMessages(stateMessages),
  )) {
    throw new Error("Cloned Agent Server getState() does not match the latest getHistory() checkpoint.");
  }

  return {
    expectedMessageCount: options.expected.transcript.length,
    verifiedMessageCount: stateMessages.length,
    expectedCheckpointCount: options.expected.checkpoints.length,
    verifiedCheckpointCount: historyCheckpoints.length,
    sourceTurnCount: options.expected.sourceTurnCount,
    provenance: {
      cloneSource: String(threadMetadata.clone_source),
      sourceThreadId: String(threadMetadata.source_thread_id),
      sourceProject: String(threadMetadata.source_project),
      sourceTurnCount: Number(threadMetadata.source_turn_count),
    },
  };
}

export function threadRunsToSupersteps(rootRuns: Run[], childRuns: Run[]): {
  supersteps: Superstep[];
  nodeNames: string[];
} {
  if (!rootRuns.length) throw new Error("LangSmith returned no root runs for this thread.");

  const roots = orderedRuns(rootRuns);
  const rootOrder = new Map(roots.map((run, index) => [run.id, index]));
  const updates = childRuns
    .filter((run) => rootOrder.has(run.parent_run_id ?? "") && run.outputs !== null && run.outputs !== undefined)
    .filter((run) => !node(run).startsWith("__"))
    .sort((left, right) => {
      const turnDifference = rootOrder.get(left.parent_run_id ?? "")! - rootOrder.get(right.parent_run_id ?? "")!;
      return turnDifference || step(left) - step(right) || String(left.id).localeCompare(String(right.id));
    });

  if (!updates.length) throw new Error("LangSmith returned no reconstructable LangGraph node runs.");

  const supersteps: Superstep[] = [{ updates: [{ values: {}, asNode: "__input__" }] }];
  for (const root of roots) {
    const input = record(root.inputs);
    if (!messages(input)) throw new Error(`LangSmith root run ${root.id} is missing a structured input message list.`);
    supersteps.push({ updates: [{ values: input, asNode: "__start__" }] });

    let currentSourceStep: number | undefined;
    for (const run of updates.filter((candidate) => candidate.parent_run_id === root.id)) {
      const currentStep = step(run);
      const update = { values: record(run.outputs), asNode: node(run) };
      if (currentSourceStep === currentStep) supersteps.at(-1)!.updates.push(update);
      else {
        supersteps.push({ updates: [update] });
        currentSourceStep = currentStep;
      }
    }
  }

  return {
    supersteps,
    nodeNames: [...new Set(updates.map(node).filter((name) => !name.startsWith("__")))],
  };
}

function readArgument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

export function studioUrl(agentUrl: string, graphId: string, threadId: string, organizationId?: string) {
  const path = organizationId ? `/o/${organizationId}/studio/thread` : "/studio/thread";
  const url = new URL(path, "https://smith.langchain.com");
  url.searchParams.set("baseUrl", agentUrl);
  url.searchParams.set("threadId", threadId);
  url.searchParams.set("assistantId", graphId);
  url.searchParams.set("mode", "graph");
  return url.toString();
}

export function createCloneMetadata(sourceThreadId: string, projectName: string, sourceTurnCount: number) {
  return {
    clone_source: "langsmith_thread",
    source_thread_id: sourceThreadId,
    source_project: projectName,
    source_turn_count: sourceTurnCount,
  };
}

export async function cloneLangSmithThread(options: {
  sourceThreadId: string;
  projectName: string;
  apiKey: string;
  langSmithEndpoint: string;
  agentUrl: string;
  graphId: string;
  organizationId?: string;
}) {
  const langSmith = new LangSmithClient({ apiKey: options.apiKey, apiUrl: options.langSmithEndpoint });
  const rootRuns: Run[] = [];
  const childRuns: Run[] = [];
  for await (const run of langSmith.readThread({
    threadId: options.sourceThreadId,
    projectName: options.projectName,
    isRoot: true,
    order: "asc",
  })) rootRuns.push(run);
  for await (const run of langSmith.readThread({
    threadId: options.sourceThreadId,
    projectName: options.projectName,
    isRoot: false,
    order: "asc",
  })) childRuns.push(run);

  const converted = threadRunsToSupersteps(rootRuns, childRuns);
  const agentServer = new AgentServerClient({ apiUrl: options.agentUrl });
  const graph = await agentServer.assistants.getGraph(options.graphId);
  const availableNodes = new Set(graph.nodes.flatMap((graphNode) => [String(graphNode.id), graphNode.name ?? ""]));
  const missingNodes = converted.nodeNames.filter((name) => !availableNodes.has(name));
  if (missingNodes.length) throw new Error(`Local graph is missing node(s): ${missingNodes.join(", ")}.`);

  const expected = buildExpectedThread(rootRuns);
  const thread = await agentServer.threads.create({
    graphId: options.graphId,
    supersteps: converted.supersteps,
    metadata: {
      ...createCloneMetadata(options.sourceThreadId, options.projectName, rootRuns.length),
      cloned_at: new Date().toISOString(),
    },
  });
  const clonedThread = await agentServer.threads.get(thread.thread_id);
  const state = await agentServer.threads.getState(thread.thread_id);
  const history = await agentServer.threads.getHistory(thread.thread_id);
  const verification = verifyClonedThread({
    expected,
    sourceThreadId: options.sourceThreadId,
    projectName: options.projectName,
    threadMetadata: clonedThread.metadata,
    stateValues: state.values,
    history,
  });

  return {
    threadId: thread.thread_id,
    sourceTurnCount: expected.sourceTurnCount,
    historyLength: history.length,
    state: state.values,
    verification,
    studioUrl: studioUrl(options.agentUrl, options.graphId, thread.thread_id, options.organizationId),
  };
}

async function main() {
  const envPath = resolve(rootDirectory, ".env");
  if (existsSync(envPath)) dotenv.config({ path: envPath, override: false, quiet: true });
  const sourceThreadId = readArgument("--thread");
  if (!sourceThreadId) throw new Error("Usage: pnpm agent:clone-thread -- --thread <langsmith-thread-id>");
  const apiKey = process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY;
  if (!apiKey) throw new Error("LANGSMITH_API_KEY or LANGCHAIN_API_KEY is required.");

  const result = await cloneLangSmithThread({
    sourceThreadId,
    projectName: readArgument("--project") ?? process.env.LANGSMITH_PROJECT ?? "study-abroad-v2-agents",
    apiKey,
    langSmithEndpoint: process.env.LANGSMITH_ENDPOINT ?? "https://api.smith.langchain.com",
    agentUrl: readArgument("--agent-url") ?? process.env.AGENT_SERVER_URL ?? "http://localhost:2025",
    graphId: readArgument("--graph") ?? process.env.SMOKE_TEST_GRAPH_ID ?? "agent",
    organizationId: readArgument("--organization") ?? process.env.LANGSMITH_ORGANIZATION_ID,
  });
  console.log(JSON.stringify(result, null, 2));
}

const invokedScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedScript) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
