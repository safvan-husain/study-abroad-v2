import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { DbConnection } from "@study-abroad/spacetimedb-bindings";

dotenv.config({ path: resolve(import.meta.dirname, "../.env") });

if (!Promise.withResolvers) {
  Promise.withResolvers = function withResolvers<T>() {
    let resolvePromise!: (value: T | PromiseLike<T>) => void;
    let rejectPromise!: (reason?: unknown) => void;
    const promise = new Promise<T>((resolve, reject) => {
      resolvePromise = resolve;
      rejectPromise = reject;
    });
    return { promise, resolve: resolvePromise, reject: rejectPromise };
  };
}

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
            }).subscribe(["SELECT * FROM worker_pending_turns", "SELECT * FROM worker_pending_work_items"]);
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
  "SELECT * FROM my_workspace_work_sets",
  "SELECT * FROM my_workspace_work_items",
  "SELECT * FROM my_workspace_work_controls",
  "SELECT * FROM my_workspace_results",
  "SELECT * FROM my_ui_activities",
  "SELECT * FROM my_ui_activity_receipts",
  "SELECT * FROM my_ui_client_contexts",
  "SELECT * FROM my_user_actions",
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
    workKind: "discovery_guidance",
    workItems: [
      { entityType: "discovery_topic", entityId: "background", kind: "advisor_prompt", displayTitle: "Preparing background", orderIndex: 0, targetJson: '{"schemaVersion":1,"viewType":"catalog"}', dependencyJson: '{}', inputJson: '{"title":"Background"}' },
      { entityType: "discovery_topic", entityId: "ambition", kind: "advisor_prompt", displayTitle: "Preparing ambition", orderIndex: 1, targetJson: '{"schemaVersion":1,"viewType":"catalog"}', dependencyJson: '{}', inputJson: '{"title":"Ambition"}' },
    ],
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

  const workSet = await waitFor(
    () => [...studentOneTables.my_workspace_work_sets.iter()].find((row: any) => row.sourceTurnId === turnId),
    "the atomic child work set",
  );
  const workerItems = await waitFor(
    () => {
      const rows = [...workerTables.worker_pending_work_items.iter()].filter((row: any) => row.workSetId === workSet.workSetId);
      return rows.length === 2 ? rows : undefined;
    },
    "two worker-visible child items",
  );
  const [firstItem, secondItem] = workerItems;

  const navigationTurnId = `navigation-${randomUUID()}`;
  await studentOne.reducers.sendMessage({
    conversationId,
    clientCommandId: navigationTurnId,
    content: "Return my workspace focus to discovery while the background work continues.",
  });
  await waitFor(
    () => [...workerTables.worker_pending_turns.iter()].find((row: any) => row.turnId === navigationTurnId),
    "the navigation turn",
  );
  await worker.reducers.claim({ turnId: navigationTurnId, expectedAttempt: 0, leaseSeconds: 30n });
  await worker.reducers.completeTurn({
    turnId: navigationTurnId,
    attempt: 1,
    assistantContent: "Your discovery workspace is ready.",
    runId: `run-${navigationTurnId}`,
    agentThreadId: conversationId,
    directiveSchemaVersion: 1,
    directiveUiRevision: 2n,
    directiveType: "discovery",
    directiveAwareness: "Discovery is your current workspace focus.",
    workKind: "",
    workItems: [],
  });

  await worker.reducers.claimWorkItem({ workItemId: secondItem.workItemId, expectedAttempt: 0, leaseSeconds: 30n });
  await worker.reducers.completeWorkItem({ workItemId: secondItem.workItemId, attempt: 1, resultJson: '{"title":"Ambition","detail":"Completed second."}', runId: undefined });
  await waitFor(
    () => [...studentOneTables.my_workspace_results.iter()].find((row: any) => row.workItemId === secondItem.workItemId),
    "the independently completed second child",
  );
  const secondActivity = await waitFor(
    () => [...studentOneTables.my_ui_activities.iter()].find((row: any) => row.workItemId === secondItem.workItemId),
    "the atomic UI activity for the completed child",
  );
  const secondControl = [...studentOneTables.my_workspace_work_controls.iter()]
    .find((row: any) => row.workItemId === secondItem.workItemId);
  if (secondControl?.targetJson !== secondItem.targetJson || secondActivity.targetJson !== secondItem.targetJson) {
    throw new Error("Completed child did not retain its semantic UI target");
  }
  if ([...studentOneTables.my_workspace_work_items.iter()].find((row: any) => row.workItemId === secondItem.workItemId)?.status !== "completed") {
    throw new Error("A valid background child was invalidated by an unrelated UI directive change");
  }
  await studentOne.reducers.publishUiContext({
    conversationId,
    clientInstanceId: "spacetime-smoke-client",
    targetJson: '{"schemaVersion":1,"viewType":"home"}',
    navigationRevision: 1n,
    visible: true,
  });
  await studentOne.reducers.acknowledgeUiActivity({ conversationId, activityId: secondActivity.activityId, state: "opened" });
  await waitFor(
    () => [...studentOneTables.my_ui_activity_receipts.iter()].find((row: any) => row.activityId === secondActivity.activityId && row.state === "opened"),
    "the UI activity receipt",
  );
  if ([...studentOneTables.my_workspace_results.iter()].some((row: any) => row.workItemId === firstItem.workItemId)) {
    throw new Error("First child appeared before its independent completion");
  }
  const partialSet = [...studentOneTables.my_workspace_work_sets.iter()].find((row: any) => row.workSetId === workSet.workSetId);
  if (partialSet?.status !== "partial") throw new Error(`Expected partial work set, received ${partialSet?.status}`);

  let duplicateWasRejected = false;
  try {
    await worker.reducers.completeWorkItem({ workItemId: secondItem.workItemId, attempt: 1, resultJson: '{"title":"Duplicate"}', runId: undefined });
  } catch {
    duplicateWasRejected = true;
  }
  if (!duplicateWasRejected) throw new Error("Duplicate child completion was accepted");

  await worker.reducers.claimWorkItem({ workItemId: firstItem.workItemId, expectedAttempt: 0, leaseSeconds: 30n });
  await worker.reducers.completeWorkItem({ workItemId: firstItem.workItemId, attempt: 1, resultJson: '{"title":"Background","detail":"Completed first."}', runId: undefined });
  await waitFor(
    () => [...studentOneTables.my_workspace_work_sets.iter()].find((row: any) => row.workSetId === workSet.workSetId && row.status === "completed"),
    "the completed reverse-order work set",
  );
  if ([...studentTwoTables.my_workspace_results.iter()].some((row: any) => row.workSetId === workSet.workSetId)) {
    throw new Error("Second student observed the first student's child results");
  }
  if ([...studentTwoTables.my_ui_activities.iter()].some((row: any) => row.conversationId === conversationId)) {
    throw new Error("Second student observed the first student's UI activities");
  }

  studentOneTables.my_turns.removeOnInsert(onTurnInsert);
  console.log(`Coordinator smoke passed: ${conversationId}/${turnId}`);
} finally {
  studentOne.disconnect();
  studentTwo.disconnect();
  worker.disconnect();
}
