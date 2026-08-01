import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@langchain/langgraph-sdk";
import { Client as LangSmithClient, type Run, uuid7 } from "langsmith";
import dotenv from "dotenv";

const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const rootEnvPath = resolve(rootDirectory, ".env");

export interface SmokeTestConfig {
  agentServerUrl: string;
  smokeTestGraphId: string;
  langSmithProject: string;
  langSmithApiKey?: string;
  langSmithEndpoint: string;
  langSmithTracing: boolean;
}

export interface RunMetadata extends Record<string, string> {
  correlation_id: string;
  graph_id: string;
  phase: "phase-1-agent-observability";
  langsmith_project: string;
  thread_id: string;
}

export interface ObservabilityEvidence {
  first: { output: Record<string, unknown>; runId: string; metadata: Record<string, unknown> };
  second: { output: Record<string, unknown>; runId: string; metadata: Record<string, unknown> };
  state: Record<string, unknown>;
  threadId: string;
  threadMetadata: Record<string, unknown>;
  metadata: RunMetadata;
  externalTrace: "verified" | "not_configured";
  externalThreadRunIds: string[];
}

function loadRootEnvironment() {
  if (existsSync(rootEnvPath)) {
    dotenv.config({ path: rootEnvPath, override: false });
  }
}

function parseBoolean(value: string | undefined) {
  return value === "1" || value?.toLowerCase() === "true";
}

export function loadSmokeTestConfig(): SmokeTestConfig {
  loadRootEnvironment();

  const langSmithApiKey = process.env.LANGSMITH_API_KEY || process.env.LANGCHAIN_API_KEY || undefined;
  const langSmithTracing = parseBoolean(process.env.LANGSMITH_TRACING ?? process.env.LANGCHAIN_TRACING_V2);
  const config: SmokeTestConfig = {
    agentServerUrl: process.env.AGENT_SERVER_URL ?? "http://localhost:2024",
    smokeTestGraphId: process.env.SMOKE_TEST_GRAPH_ID ?? "agent",
    langSmithProject: process.env.LANGSMITH_PROJECT ?? "study-abroad-v2-agents",
    langSmithApiKey,
    langSmithEndpoint: process.env.LANGSMITH_ENDPOINT ?? "https://api.smith.langchain.com",
    langSmithTracing,
  };

  if (config.langSmithTracing && !config.langSmithApiKey) {
    throw new Error(
      "LANGSMITH_TRACING requires LANGSMITH_API_KEY (or LANGCHAIN_API_KEY) in the repository-root .env",
    );
  }

  return config;
}

export function createRunMetadata(config: SmokeTestConfig, threadId: string): RunMetadata {
  return {
    correlation_id: `phase-1-${randomUUID()}`,
    graph_id: config.smokeTestGraphId,
    phase: "phase-1-agent-observability",
    langsmith_project: config.langSmithProject,
    thread_id: threadId,
  };
}

async function waitForServer(config: SmokeTestConfig) {
  const healthUrl = new URL("/ok", config.agentServerUrl);
  const response = await fetch(healthUrl);
  if (!response.ok) {
    throw new Error(`Agent Server health check failed with HTTP ${response.status}`);
  }
}

async function getAssistantId(client: Client, config: SmokeTestConfig, metadata: RunMetadata) {
  const existing = await client.assistants.search({
    graphId: config.smokeTestGraphId,
    name: "study-abroad-v2-agent",
    limit: 1,
  });

  if (existing[0]) {
    return existing[0].assistant_id;
  }

  const assistant = await client.assistants.create({
    graphId: config.smokeTestGraphId,
    name: "study-abroad-v2-agent",
    metadata,
  });
  return assistant.assistant_id;
}

async function runGraph(
  client: Client,
  config: SmokeTestConfig,
  assistantId: string,
  threadId: string,
  metadata: RunMetadata,
  input: string,
) {
  let runId: string | undefined;
  const output = await client.runs.wait(threadId, assistantId, {
    input: { messages: [{ role: "human", content: input }] },
    metadata,
    multitaskStrategy: "reject",
    onRunCreated: (run) => {
      runId = run.run_id;
    },
  });

  if (!runId) {
    throw new Error("Agent Server did not return a run ID");
  }

  const run = await client.runs.get(threadId, runId);
  return {
    output: output as Record<string, unknown>,
    runId,
    metadata: (run.metadata ?? {}) as Record<string, unknown>,
  };
}

async function verifyExternalThread(config: SmokeTestConfig, metadata: RunMetadata, runIds: string[]) {
  if (!config.langSmithTracing) {
    return {
      status: "not_configured" as const,
      runIds: [],
    };
  }

  const client = new LangSmithClient({
    apiKey: config.langSmithApiKey,
    apiUrl: config.langSmithEndpoint,
  });
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    const rootRuns: Run[] = [];
    for await (const run of client.readThread({
      threadId: metadata.thread_id,
      projectName: config.langSmithProject,
      isRoot: true,
      order: "asc",
    })) {
      rootRuns.push(run);
    }
    const childRuns: Run[] = [];
    for await (const run of client.readThread({
      threadId: metadata.thread_id,
      projectName: config.langSmithProject,
      isRoot: false,
      order: "asc",
    })) {
      childRuns.push(run);
    }
    const threadRuns = [...rootRuns, ...childRuns];
    const groupedThreads = await client.listThreads({
      projectName: config.langSmithProject,
      startTime: new Date(Date.now() - 5 * 60_000),
      limit: 100,
    });
    const groupedThread = groupedThreads.find((thread) => thread.thread_id === metadata.thread_id);

    const observedRunIds = threadRuns.map((run) => run.id).filter((id): id is string => Boolean(id));
    const hasExpectedRuns = runIds.every((runId) => rootRuns.some((run) => run.id === runId));
    const hasExpectedMetadata = rootRuns
      .filter((run) => runIds.includes(run.id))
      .every((run) => {
        const runMetadata = (run.extra?.metadata ?? {}) as Record<string, unknown>;
        return (
          runMetadata.thread_id === metadata.thread_id &&
          runMetadata.correlation_id === metadata.correlation_id
        );
      });
    const hasThreadMetadataOnEveryRun = threadRuns.every((run) => {
      const runMetadata = (run.extra?.metadata ?? {}) as Record<string, unknown>;
      return runMetadata.thread_id === metadata.thread_id;
    });
    const hasChildRuns = childRuns.length >= runIds.length;
    const hasThreadListGrouping = (groupedThread?.count ?? 0) >= runIds.length;

    if (
      hasExpectedRuns &&
      hasExpectedMetadata &&
      hasThreadMetadataOnEveryRun &&
      hasChildRuns &&
      hasThreadListGrouping
    ) {
      return {
        status: "verified" as const,
        runIds: observedRunIds,
      };
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
  }

  throw new Error(
    `LangSmith thread ${metadata.thread_id} did not contain root runs ${runIds.join(", ")} with propagated child metadata in ${config.langSmithProject}`,
  );
}

export async function runObservabilitySmoke(): Promise<ObservabilityEvidence> {
  const config = loadSmokeTestConfig();
  const client = new Client({ apiUrl: config.agentServerUrl });
  await waitForServer(config);

  const threadId = uuid7();
  const metadata = createRunMetadata(config, threadId);
  const assistantId = await getAssistantId(client, config, metadata);
  const thread = await client.threads.create({ threadId, metadata });
  if (thread.thread_id !== threadId) {
    throw new Error(`Agent Server returned thread ${thread.thread_id}, expected ${threadId}`);
  }
  const first = await runGraph(client, config, assistantId, threadId, metadata, "local-observability");
  const second = await runGraph(client, config, assistantId, threadId, metadata, "local-observability");
  const state = await client.threads.getState(threadId);
  const externalThread = await verifyExternalThread(config, metadata, [first.runId, second.runId]);

  return {
    first,
    second,
    state: state.values as Record<string, unknown>,
    threadId,
    threadMetadata: (thread.metadata ?? {}) as Record<string, unknown>,
    metadata,
    externalTrace: externalThread.status,
    externalThreadRunIds: externalThread.runIds,
  };
}

export function printEvidence(evidence: ObservabilityEvidence) {
  console.log(`agent_server_thread_id=${evidence.threadId}`);
  console.log(`agent_server_first_run_id=${evidence.first.runId}`);
  console.log(`agent_server_second_run_id=${evidence.second.runId}`);
  console.log(`correlation_id=${evidence.metadata.correlation_id}`);
  console.log(`thread_metadata=${JSON.stringify(evidence.threadMetadata)}`);
  console.log(`first_run_metadata=${JSON.stringify(evidence.first.metadata)}`);
  console.log(`second_run_metadata=${JSON.stringify(evidence.second.metadata)}`);
  console.log(`first_output=${JSON.stringify(evidence.first.output)}`);
  console.log(`second_output=${JSON.stringify(evidence.second.output)}`);
  console.log(`thread_state=${JSON.stringify(evidence.state)}`);
  console.log(`external_thread_run_ids=${JSON.stringify(evidence.externalThreadRunIds)}`);
  console.log(`external_trace=${evidence.externalTrace}`);
}

async function main() {
  const evidence = await runObservabilitySmoke();
  printEvidence(evidence);
}

const invokedScript = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedScript) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
