import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { DbConnection } from "@study-abroad/spacetimedb-bindings";

dotenv.config({ path: resolve(import.meta.dirname, "../.env") });

const server = process.env.SPACETIME_URL;

if (!server) {
  console.log("Coordinator smoke skipped: set SPACETIME_URL for a live SpacetimeDB instance.");
  process.exit(0);
}

const database = process.env.SPACETIME_DATABASE;
if (!database) {
  throw new Error("Set SPACETIME_DATABASE to the published coordinator database name.");
}

const agentUsername = process.env.AGENT_USERNAME ?? "study_abroad_agent";
const agentPassword = process.env.AGENT_PASSWORD ?? "study-agent-dev";

const spacetime = process.env.SPACETIME_BIN ?? "spacetime";
if (process.env.SPACETIME_PUBLISH === "true") {
  execFileSync(
    spacetime,
    ["publish", database, "--server", server, "--module-path", "coordinator/spacetimedb", "--anonymous", "--yes"],
    { stdio: "inherit" },
  );
}

const uri = server.replace(/^http/, "ws");
const conversationId = `conversation-${randomUUID()}`;
const commandId = `command-${randomUUID()}`;
const turnId = commandId;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitFor<T>(read: () => T | undefined, description: string): Promise<T> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const value = read();
    if (value !== undefined) return value;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${description}`);
}

async function connect(queries: string[], token?: string) {
  return new Promise<InstanceType<typeof DbConnection>>((resolve, reject) => {
    let settled = false;
    const builder = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(database)
      .withToken(token)
      .onConnect((connection) => {
        connection.subscriptionBuilder().onApplied(() => {
          if (!settled) {
            settled = true;
            resolve(connection);
          }
        }).subscribe(queries);
      })
      .onConnectError((_context, error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    builder.build();
  });
}

async function connectWorker() {
  return new Promise<InstanceType<typeof DbConnection>>((resolve, reject) => {
    let settled = false;
    const builder = DbConnection.builder()
      .withUri(uri)
      .withDatabaseName(database)
      .onConnect((connection) => {
        void connection.reducers.login({ username: agentUsername, password: agentPassword })
          .then(() => connection.reducers.registerWorker({ workerLabel: "spacetime-smoke" }))
          .then(() => {
            connection.subscriptionBuilder().onApplied(() => {
              if (!settled) {
                settled = true;
                resolve(connection);
              }
            }).subscribe("SELECT * FROM worker_pending_turns");
          })
          .catch((error: unknown) => {
            if (!settled) {
              settled = true;
              reject(error);
            }
          });
      })
      .onConnectError((_context, error) => {
        if (!settled) {
          settled = true;
          reject(error);
        }
      });
    builder.build();
  });
}

const studentQueries = [
  "SELECT * FROM my_conversations",
  "SELECT * FROM my_messages",
  "SELECT * FROM my_message_parts",
  "SELECT * FROM my_turns",
  "SELECT * FROM my_active_directives",
];
const studentOne = await connect(studentQueries);
const studentTwo = await connect(studentQueries);
const worker = await connectWorker();

try {
  const studentOneTables = studentOne.db as any;
  const studentTwoTables = studentTwo.db as any;
  const workerTables = worker.db as any;
  let atomicCompletionObserved = false;
  const onTurnInsert = (_context: unknown, current: any) => {
    if (current.turnId !== turnId || current.status !== "completed") return;
    const hasAssistant = [...studentOneTables.my_messages.iter()]
      .some((message: any) => message.messageId === `${turnId}-assistant`);
    const hasPart = [...studentOneTables.my_message_parts.iter()]
      .some((part: any) => part.partId === turnId);
    const directive = [...studentOneTables.my_active_directives.iter()]
      .find((candidate: any) => candidate.conversationId === conversationId);
    atomicCompletionObserved = hasAssistant && hasPart && directive?.uiRevision === 1n;
  };
  studentOneTables.my_turns.onInsert(onTurnInsert);

  await studentOne.reducers.ensureGuestJourney({ conversationId });
  await waitFor(
    () => [...studentOneTables.my_conversations.iter()].find((row: any) => row.conversationId === conversationId),
    "the first student's conversation",
  );
  if ([...studentTwoTables.my_conversations.iter()].some((row: any) => row.conversationId === conversationId)) {
    throw new Error("Second student observed the first student's conversation");
  }

  let secondStudentWasDenied = false;
  try {
    await studentTwo.reducers.sendMessage({
      conversationId,
      clientCommandId: `blocked-${randomUUID()}`,
      content: "This must not be accepted.",
    });
  } catch {
    secondStudentWasDenied = true;
  }
  if (!secondStudentWasDenied) {
    throw new Error("Second student mutated the first student's conversation");
  }

  await studentOne.reducers.sendMessage({ conversationId, clientCommandId: commandId, content: "I am interested in software engineering." });
  await studentOne.reducers.sendMessage({ conversationId, clientCommandId: commandId, content: "I am interested in software engineering." });
  await waitFor(
    () => [...studentOneTables.my_messages.iter()].find((row: any) => row.messageId === commandId),
    "the atomic user message",
  );
  const submittedTurn = await waitFor(
    () => [...studentOneTables.my_turns.iter()].find((row: any) => row.turnId === turnId),
    "the atomic pending turn",
  );
  if (submittedTurn.status !== "pending") {
    throw new Error(`Expected a pending turn after submission, received ${submittedTurn.status}`);
  }
  if ([...studentOneTables.my_messages.iter()].filter((row: any) => row.messageId === commandId).length !== 1) {
    throw new Error("Duplicate client command created multiple user messages");
  }
  if ([...studentOneTables.my_turns.iter()].filter((row: any) => row.turnId === turnId).length !== 1) {
    throw new Error("Duplicate client command created multiple turn jobs");
  }
  if ([...studentTwoTables.my_messages.iter()].some((row: any) => row.conversationId === conversationId)) {
    throw new Error("Second student observed the first student's messages");
  }

  const pendingTurn = await waitFor(
    () => [...workerTables.worker_pending_turns.iter()].find((row: any) => row.turnId === turnId),
    "the worker-visible pending turn",
  );
  if (pendingTurn.userContent !== "I am interested in software engineering.") {
    throw new Error("Worker did not receive the canonical user message content");
  }

  await worker.reducers.claim({ turnId, expectedAttempt: 0, leaseSeconds: 30n });
  await worker.reducers.completeTurn({
    turnId,
    attempt: 1,
    assistantContent: "Tell me about the subjects you enjoy most.",
    runId: `run-${turnId}`,
    agentThreadId: conversationId,
    directiveSchemaVersion: 1,
    directiveUiRevision: 1n,
    directiveType: "discovery",
    directiveAwareness: "I am ready to learn about your study-abroad goals.",
  });
  const completedTurn = await waitFor(
    () => [...studentOneTables.my_turns.iter()].find((row: any) => row.turnId === turnId && row.status === "completed"),
    "the completed turn",
  );
  if (completedTurn.runId !== `run-${turnId}` || !atomicCompletionObserved) {
    throw new Error("Assistant completion was not observed as one atomic transcript, directive, and turn update");
  }
  if ([...studentTwoTables.my_messages.iter()].some((row: any) => row.turnId === turnId)) {
    throw new Error("Second student observed the assistant completion");
  }

  studentOneTables.my_turns.removeOnInsert(onTurnInsert);
  console.log(`Coordinator smoke passed: ${conversationId}/${turnId}`);
} finally {
  studentOne.disconnect();
  studentTwo.disconnect();
  worker.disconnect();
}
