import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import dotenv from "dotenv";
import { DbConnection } from "../packages/spacetimedb-bindings/src/index.js";

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

const spacetime = process.env.SPACETIME_BIN ?? "spacetime";
if (process.env.SPACETIME_PUBLISH === "true") {
  execFileSync(
    spacetime,
    ["publish", database, "--server", server, "--module-path", "coordinator/spacetimedb", "--anonymous", "--yes"],
    { stdio: "inherit" },
  );
}

const uri = server.replace(/^http/, "ws");
const turnId = `smoke-${randomUUID()}`;
const conversationId = `conversation-${randomUUID()}`;
const agentThreadId = conversationId;
const idempotencyKey = `idempotency-${turnId}`;

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function waitForStatus(connection: InstanceType<typeof DbConnection>, status: string) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const row = [...connection.db.job.iter()].find((candidate) => candidate.turnId === turnId);
    if (row?.status === status) return row;
    await sleep(250);
  }
  throw new Error(`Timed out waiting for coordinator job ${turnId} to become ${status}`);
}

const connection = await new Promise<InstanceType<typeof DbConnection>>((resolve, reject) => {
  let settled = false;
  const builder = DbConnection.builder()
    .withUri(uri)
    .withDatabaseName(database)
    .onConnect((connected) => {
      connected.subscriptionBuilder().onApplied(() => {
        if (!settled) {
          settled = true;
          resolve(connected);
        }
      }).subscribe("SELECT * FROM job");
    })
    .onConnectError((_context, error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
  builder.build();
});

try {
  connection.reducers.enqueue({ conversationId, turnId, agentThreadId, idempotencyKey });
  await waitForStatus(connection, "pending");
  connection.reducers.claim({ turnId, leaseSeconds: 30n });
  await waitForStatus(connection, "claimed");
  connection.reducers.complete({ turnId, runId: `run-${turnId}`, result: `message=${turnId}` });
  const completed = await waitForStatus(connection, "completed");

  if (completed.runId !== `run-${turnId}` || completed.result !== `message=${turnId}`) {
    throw new Error("Coordinator smoke observed an unexpected compact completion result");
  }

  console.log(`Coordinator smoke passed: ${conversationId}/${turnId}`);
} finally {
  connection.disconnect();
}
