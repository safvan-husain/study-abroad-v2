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

export function threadRunsToSupersteps(rootRuns: Run[], childRuns: Run[]): {
  supersteps: Superstep[];
  nodeNames: string[];
} {
  if (!rootRuns.length) throw new Error("LangSmith returned no root runs for this thread.");

  const roots = [...rootRuns].sort((left, right) =>
    String(left.start_time ?? left.id).localeCompare(String(right.start_time ?? right.id)),
  );
  const rootOrder = new Map(roots.map((run, index) => [run.id, index]));
  const updates = childRuns
    .filter((run) => rootOrder.has(run.parent_run_id ?? "") && run.outputs !== null && run.outputs !== undefined)
    .sort((left, right) => {
      const turnDifference = rootOrder.get(left.parent_run_id ?? "")! - rootOrder.get(right.parent_run_id ?? "")!;
      return turnDifference || step(left) - step(right) || String(left.id).localeCompare(String(right.id));
    });

  if (!updates.length) throw new Error("LangSmith returned no reconstructable LangGraph node runs.");

  const supersteps: Superstep[] = [{ updates: [{ values: {}, asNode: "__input__" }] }];
  let currentSourceStep: number | undefined;
  for (const run of updates) {
    const currentStep = step(run);
    const update = { values: record(run.outputs), asNode: node(run) };
    if (currentSourceStep === currentStep) supersteps.at(-1)!.updates.push(update);
    else {
      supersteps.push({ updates: [update] });
      currentSourceStep = currentStep;
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

  const thread = await agentServer.threads.create({
    graphId: options.graphId,
    supersteps: converted.supersteps,
    metadata: {
      ...createCloneMetadata(options.sourceThreadId, options.projectName, rootRuns.length),
      cloned_at: new Date().toISOString(),
    },
  });
  const history = await agentServer.threads.getHistory(thread.thread_id);
  return {
    threadId: thread.thread_id,
    sourceTurnCount: rootRuns.length,
    historyLength: history.length,
    state: history[0]?.values ?? {},
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
    agentUrl: readArgument("--agent-url") ?? process.env.AGENT_SERVER_URL ?? "http://localhost:2024",
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
