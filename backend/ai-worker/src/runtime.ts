import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { ChatTurn } from './services/process-chat-turn.js';
import { loadConfig } from './config.js';
import { createWorker } from './index.js';
import { SpacetimeCoordinatorAdapter, type PendingJobSource } from './services/coordinator-adapter.js';
import type { PendingWorkItemSource } from './services/coordinator-adapter.js';
import type { WorkspaceWorkItem } from './services/process-work-item.js';
import { uiTargetRef, type UserUiState } from '@study-abroad/contracts';

let shuttingDown = false;

type CatalogSeedCourse = {
  courseId: string;
  institutionId: string;
  institutionName: string;
  country: string;
  city: string;
  name: string;
  area: string;
  level: string;
  tuitionBand: string;
  englishBar: string;
  familyId: string;
  qualification: string;
  officialUrl: string;
  ownership: string;
  requirements: unknown[];
  rankings: unknown[];
  sources: unknown[];
};

type CatalogSeedSnapshot = {
  institutions: Array<Record<string, unknown>>;
  families: Array<Record<string, unknown>>;
  courses: CatalogSeedCourse[];
  policy: Record<string, unknown>;
};

function loadCatalogSeed(): CatalogSeedSnapshot | undefined {
  const baseCandidates = [
    join(dirname(fileURLToPath(import.meta.url)), '../../../scripts/catalog'),
    join(process.cwd(), 'scripts/catalog'),
  ];
  for (const base of baseCandidates) {
    try {
      return {
        institutions: JSON.parse(readFileSync(join(base, 'institutions.json'), 'utf8')) as Array<Record<string, unknown>>,
        families: JSON.parse(readFileSync(join(base, 'families.json'), 'utf8')) as Array<Record<string, unknown>>,
        courses: JSON.parse(readFileSync(join(base, 'courses.json'), 'utf8')) as CatalogSeedCourse[],
        policy: JSON.parse(readFileSync(join(base, 'policy.json'), 'utf8')) as Record<string, unknown>,
      };
    } catch {
      // try next base
    }
  }
  return undefined;
}

/* kept separate from the startup side effect so catalog failures remain explicit */
function richCourseSeed(course: CatalogSeedCourse) {
  return {
    courseId: course.courseId, institutionId: course.institutionId, institutionName: course.institutionName,
    country: course.country, city: course.city, name: course.name, area: course.area, level: course.level,
    tuitionBand: course.tuitionBand, englishBar: course.englishBar, familyId: course.familyId,
    qualification: course.qualification, officialUrl: course.officialUrl, ownership: course.ownership,
    requirementsJson: JSON.stringify(course.requirements), rankingsJson: JSON.stringify(course.rankings), sourcesJson: JSON.stringify(course.sources),
  };
}

type WorkerPendingTurnRow = {
  conversationId: string;
  turnId: string;
  agentThreadId: string;
  correlationId: string;
  userMessageId: string;
  userContent: string;
  status: string;
  leaseUntilMicros: bigint | null;
  attempt: number;
  baseUiRevision: bigint;
  baseContextRevision: bigint;
  selectionRevision: bigint;
  presentedFamilyIdsJson: string;
  selectedFamilyIdsJson: string;
  presentedOfferingIdsJson: string;
  provisionalOfferingIdsJson: string;
  suppressedOfferingIdsJson: string;
  confirmedOfferingIdsJson: string;
  comparisonCriterion: string;
  profileBackground: string;
  profileCourseInterests: string;
  profileAmbitions: string;
  profilePrimaryArea: string;
  profileCandidateAreasJson: string;
  profileStudentPhrase: string;
  profileConstraintsText: string;
  uiClientInstanceId: string;
  uiTargetJson: string;
  uiNavigationRevision: bigint;
};

function parseIdListJson(value: string | undefined): string[] {
  try {
    const parsed = JSON.parse(value ?? '[]') as unknown;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function selectionFromTurnRow(row: WorkerPendingTurnRow) {
  return {
    presentedFamilyIds: parseIdListJson(row.presentedFamilyIdsJson),
    selectedFamilyIds: parseIdListJson(row.selectedFamilyIdsJson),
    presentedOfferingIds: parseIdListJson(row.presentedOfferingIdsJson),
    provisionalOfferingIds: parseIdListJson(row.provisionalOfferingIdsJson),
    suppressedOfferingIds: parseIdListJson(row.suppressedOfferingIdsJson),
    confirmedOfferingIds: parseIdListJson(row.confirmedOfferingIdsJson),
    comparisonCriterion: String(row.comparisonCriterion ?? ''),
    revision: BigInt(row.selectionRevision ?? 0n),
  };
}

function profileFromTurnRow(row: WorkerPendingTurnRow) {
  return {
    background: String(row.profileBackground ?? ''),
    courseInterests: String(row.profileCourseInterests ?? ''),
    ambitions: String(row.profileAmbitions ?? ''),
    primaryArea: String(row.profilePrimaryArea ?? ''),
    candidateAreas: parseIdListJson(row.profileCandidateAreasJson),
    studentPhrase: String(row.profileStudentPhrase ?? ''),
    constraintsText: String(row.profileConstraintsText ?? ''),
  };
}

type WorkerPendingWorkItemRow = {
  workItemId: string;
  workSetId: string;
  conversationId: string;
  entityType: string;
  entityId: string;
  kind: string;
  displayTitle: string;
  orderIndex: number;
  targetJson: string;
  dependencyJson: string;
  inputJson: string;
  status: string;
  leaseUntilMicros: bigint | null;
  attempt: number;
  expectedContextRevision: bigint;
  expectedUiRevision: bigint;
  uiClientInstanceId: string;
  uiTargetJson: string;
  uiNavigationRevision: bigint;
};

function originUiState(row: { uiClientInstanceId: string; uiTargetJson: string; uiNavigationRevision: bigint }): UserUiState | undefined {
  try {
    return {
      clientInstanceId: row.uiClientInstanceId,
      target: uiTargetRef.parse(JSON.parse(row.uiTargetJson)),
      navigationRevision: row.uiNavigationRevision,
      visible: true,
      lastSeenAtMicros: 0n,
    };
  } catch {
    return undefined;
  }
}

function rowToTurn(row: WorkerPendingTurnRow): ChatTurn | undefined {
  const claimedLeaseExpired = row.status === 'claimed'
    && row.leaseUntilMicros !== null
    && row.leaseUntilMicros <= BigInt(Date.now()) * 1_000n;
  if (row.status !== 'pending' && row.status !== 'retrying' && !claimedLeaseExpired) return undefined;
  const uiContext = originUiState(row);
  if (!uiContext) return undefined;
  return {
    conversationId: row.conversationId,
    turnId: row.turnId,
    correlationId: row.correlationId,
    agentThreadId: row.agentThreadId,
    userMessageId: row.userMessageId,
    userContent: row.userContent,
    attempt: row.attempt,
    baseUiRevision: row.baseUiRevision,
    baseContextRevision: row.baseContextRevision,
    uiContext,
    selectionContext: selectionFromTurnRow(row),
    profile: profileFromTurnRow(row),
  };
}

async function connect(config: ReturnType<typeof loadConfig>): Promise<DbConnection> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const builder = DbConnection.builder()
      .withUri(config.SPACETIME_URL.replace(/^http/, 'ws'))
      .withDatabaseName(config.SPACETIME_DATABASE)
      .onConnect((connection) => {
        void connection.reducers.login({ username: config.AGENT_USERNAME, password: config.AGENT_PASSWORD })
          .then(() => connection.reducers.registerWorker({ workerLabel: config.WORKER_ID }))
          .then(() => {
            connection.subscriptionBuilder().onApplied(() => {
              if (!settled) {
                settled = true;
                resolve(connection);
              }
            }).onError((context) => {
              const error = new Error(`Worker subscription failed: ${String(context.event)}`);
              if (!settled) { settled = true; reject(error); }
              else if (!shuttingDown) { console.error(error.message); process.exit(1); }
            }).subscribe([
              'SELECT * FROM worker_pending_turns',
              'SELECT * FROM worker_pending_work_items',
              'SELECT * FROM catalog_course',
              'SELECT * FROM catalog_family',
              'SELECT * FROM worker_conversation_profiles',
              'SELECT * FROM worker_user_ui_states',
            ]);
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
      })
      .onDisconnect(() => {
        if (settled && !shuttingDown) {
          console.error('Worker lost its SpacetimeDB connection; exiting for Docker restart.');
          process.exit(1);
        }
      });
    builder.build();
  });
}

function rowToWorkItem(row: WorkerPendingWorkItemRow): WorkspaceWorkItem | undefined {
  const claimedLeaseExpired = row.status === 'claimed'
    && row.leaseUntilMicros !== null
    && row.leaseUntilMicros <= BigInt(Date.now()) * 1_000n;
  if (row.status !== 'pending' && row.status !== 'retrying' && !claimedLeaseExpired) return undefined;
  const uiContext = originUiState(row);
  if (!uiContext) return undefined;
  return {
    workItemId: row.workItemId,
    workSetId: row.workSetId,
    conversationId: row.conversationId,
    entityType: row.entityType,
    entityId: row.entityId,
    kind: row.kind,
    displayTitle: row.displayTitle,
    orderIndex: row.orderIndex,
    targetJson: row.targetJson,
    dependencyJson: row.dependencyJson,
    inputJson: row.inputJson,
    attempt: row.attempt,
    expectedContextRevision: row.expectedContextRevision,
    expectedUiRevision: row.expectedUiRevision,
    uiContext,
  };
}

function createPendingWorkItemSource(connection: DbConnection): PendingWorkItemSource {
  const table = connection.db.worker_pending_work_items as any;
  let listener: ((item: WorkspaceWorkItem) => void) | undefined;
  const publish = (row: WorkerPendingWorkItemRow) => {
    const item = rowToWorkItem(row);
    if (item) listener?.(item);
  };
  return {
    subscribe(callback) {
      listener = callback;
      const onInsert = (_context: unknown, row: WorkerPendingWorkItemRow) => publish(row);
      table.onInsert(onInsert);
      return () => {
        table.removeOnInsert(onInsert);
        listener = undefined;
      };
    },
    async poll() {
      return [...table.iter()]
        .map((row: WorkerPendingWorkItemRow) => rowToWorkItem(row))
        .filter((item: WorkspaceWorkItem | undefined): item is WorkspaceWorkItem => Boolean(item));
    },
  };
}

function createPendingJobSource(connection: DbConnection): PendingJobSource {
  const table = connection.db.worker_pending_turns as any;
  let listener: ((turn: ChatTurn) => void) | undefined;

  const publish = (row: WorkerPendingTurnRow) => {
    const turn = rowToTurn(row);
    if (turn) listener?.(turn);
  };

  return {
    subscribe(callback) {
      listener = callback;
      const onInsert = (_context: unknown, row: WorkerPendingTurnRow) => publish(row);
      table.onInsert(onInsert);
      return () => {
        table.removeOnInsert(onInsert);
        listener = undefined;
      };
    },
    async poll() {
      return [...table.iter()]
        .map((row: WorkerPendingTurnRow) => rowToTurn(row))
        .filter((turn: ChatTurn | undefined): turn is ChatTurn => Boolean(turn));
    },
  };
}

const config = loadConfig();
const connection = await connect(config);
const jobs = createPendingJobSource(connection);
const workItems = createPendingWorkItemSource(connection);
const coordinator = new SpacetimeCoordinatorAdapter(connection as any, jobs, workItems, config.WORKER_LEASE_SECONDS);

if (coordinator.listCourses().length === 0) {
  const catalog = loadCatalogSeed();
  if (!catalog || catalog.courses.length === 0) {
    console.error('Catalog seed file missing; worker refusing to start without a catalogue.');
    connection.disconnect();
    process.exit(1);
  }
  try {
    await (connection.reducers as any).replaceCatalog({
      institutions: catalog.institutions.map((row) => ({
        institutionId: row.institutionId, name: row.name, country: row.country, city: row.city,
        ownership: row.ownership, aliasesJson: JSON.stringify(row.aliases ?? []), rankingsJson: JSON.stringify(row.rankings ?? []),
        sourcesJson: JSON.stringify(row.sources ?? []), active: row.active !== false,
      })),
      families: catalog.families.map((row) => ({
        familyId: row.familyId, areaId: row.areaId, name: row.name, aliasesJson: JSON.stringify(row.aliases ?? []),
        description: row.description, typicalSubjectsJson: JSON.stringify(row.typicalSubjects ?? []),
        careerDirectionsJson: JSON.stringify(row.careerDirections ?? []), relatedFamilyIdsJson: JSON.stringify(row.relatedFamilyIds ?? []),
        active: row.active !== false,
      })),
      courses: catalog.courses.map(richCourseSeed),
      policy: {
        seedVersion: catalog.policy.seedVersion, policyId: catalog.policy.policyId, version: catalog.policy.version,
        baselineDocumentTypesJson: JSON.stringify(catalog.policy.baselineDocumentTypes ?? []),
      },
    });
    console.log(`Seeded ${catalog.institutions.length} institutions and ${catalog.courses.length} catalog offerings from worker startup.`);
  } catch (error) {
    console.error('Catalog seed failed; worker refusing to start without a catalogue:', error);
    connection.disconnect();
    process.exit(1);
  }
}

const worker = createWorker({ coordinator, jobs, workItems }, config);

worker.start();
console.log(`AI worker started: ${config.WORKER_ID}`);

const shutdown = async () => {
  shuttingDown = true;
  await worker.stop();
  connection.disconnect();
  process.exit(0);
};
process.once('SIGINT', () => void shutdown());
process.once('SIGTERM', () => void shutdown());
