import {
  type AdvisorTurnResult,
  type CatalogCourseView,
  type CatalogFamilyView,
  type ChatMessage,
  type DiscoveryProfilePatch,
  type TurnUpdatePayload,
  type UserUiState,
  advisorTurnResult,
  catalogAreaDisplayName,
  rankCoursesForAreas,
} from '@study-abroad/contracts';
import type { AgentClient, AgentSelectionContext } from './agent-server-client.js';

/** Specialist discovery requires a usable catalog snapshot; below this, skip the graph. */
export const MIN_CATALOG_COURSES = 10;

export interface Coordinator {
  claim(turn: ChatTurn): Promise<number | undefined>;
  renew?(turnId: string, attempt: number, leaseSeconds: number): Promise<void>;
  complete(turnId: string, attempt: number, completion: TurnCompletion): Promise<void>;
  retry(turnId: string, attempt: number, errorCode: string): Promise<void>;
  fail?(turnId: string, attempt: number, errorCode: string): Promise<void>;
  publishTurnUpdate?(turnId: string, attempt: number, sequence: number, payload: TurnUpdatePayload): Promise<void>;
  upsertConversationProfile?(conversationId: string, profile: DiscoveryProfilePatch): Promise<void>;
}

export interface CatalogStore {
  listCourses(): CatalogCourseView[];
  listFamilies?(): CatalogFamilyView[];
  getProfile(conversationId: string): DiscoveryProfilePatch | undefined;
  getSelection?(conversationId: string): AgentSelectionContext | undefined;
  getUiState?(conversationId: string, clientInstanceId: string): UserUiState | undefined;
}

export interface ChatTurn {
  conversationId: string;
  turnId: string;
  correlationId: string;
  agentThreadId: string;
  userMessageId: string;
  userContent: string;
  attempt: number;
  baseUiRevision: bigint;
  baseContextRevision?: bigint;
  uiContext: UserUiState;
  /** Enqueue-time selection snapshot from TurnJob (authoritative for this turn). */
  selectionContext?: AgentSelectionContext;
  /** Enqueue-time profile snapshot from TurnJob (authoritative for this turn). */
  profile?: DiscoveryProfilePatch;
}

export interface TurnCompletion {
  assistantContent: string;
  runId: string;
  agentThreadId: string;
  directiveSchemaVersion: number;
  directiveUiRevision: bigint;
  directiveType: string;
  directiveAwareness: string;
  workKind: string;
  workItems: WorkItemSpec[];
  expectedContextRevision: bigint;
  selectionMode: 'none' | 'replace_provisional';
  presentedFamilyIds: string[];
  presentedOfferingIds: string[];
  provisionalOfferingIds: string[];
  proposalRationale: string;
  comparisonCriterion: string;
}

export interface WorkItemSpec {
  entityType: string;
  entityId: string;
  kind: string;
  displayTitle: string;
  orderIndex: number;
  targetJson: string;
  dependencyJson: string;
  inputJson: string;
}

function emptyProfile(): DiscoveryProfilePatch {
  return {
    background: '', courseInterests: '', ambitions: '', primaryArea: '',
    candidateAreas: [], studentPhrase: '', constraintsText: '',
  };
}

function emptySelection(): AgentSelectionContext {
  return {
    presentedFamilyIds: [], selectedFamilyIds: [], presentedOfferingIds: [],
    provisionalOfferingIds: [], suppressedOfferingIds: [], confirmedOfferingIds: [],
    revision: 0n, comparisonCriterion: '',
  };
}

function safeAdvisorFallback(profile: DiscoveryProfilePatch): AdvisorTurnResult {
  return advisorTurnResult.parse({
    assistantContent: 'I could not make a safe advisor decision. Would you like guidance about the process, or course discovery?',
    route: {
      intent: 'clarify', reason: 'The specialist graph returned no valid typed result.',
      clarificationQuestion: 'Would you like guidance about the process, or course discovery?',
    },
    proposal: { mode: 'none', offeringIds: [], rationale: '' },
    presentedFamilyIds: [], presentedOfferingIds: [],
    directive: { type: 'discovery', awareness: 'Waiting for your choice.' },
    workItems: [], workKind: '', profilePatch: profile,
  });
}

function legacyAdvisor(
  content: string,
  discovery: NonNullable<Awaited<ReturnType<AgentClient['run']>>['discovery']>,
  courses: CatalogCourseView[],
): AdvisorTurnResult {
  const ranked = rankCoursesForAreas(courses, discovery.discoveryIntent.catalogAreas, 5);
  return advisorTurnResult.parse({
    assistantContent: discovery.assistantContent || content,
    route: { intent: 'discovery', reason: 'Legacy graph selected.', clarificationQuestion: '' },
    scope: ranked.length ? {
      scope: 'family_offerings', areaId: '', familyIds: [], offeringIds: ranked.map((row) => row.courseId),
      explanation: 'Legacy ranked catalogue results.', clarificationQuestion: '',
    } : undefined,
    proposal: { mode: 'none', offeringIds: [], rationale: '' },
    presentedFamilyIds: [], presentedOfferingIds: ranked.map((row) => row.courseId),
    directive: discovery.directive, workItems: [], workKind: ranked.length ? 'course_fit_summaries' : '',
    profilePatch: discovery.profilePatch,
  });
}

function buildWorkItems(
  turn: ChatTurn,
  advisor: AdvisorTurnResult,
  courses: CatalogCourseView[],
  families: CatalogFamilyView[],
): WorkItemSpec[] {
  const workSetId = `${turn.turnId}-work`;
  if (advisor.workKind === 'areas_overview') {
    const byArea = new Map<string, CatalogFamilyView[]>();
    for (const family of families) {
      if (!family.areaId) continue;
      const list = byArea.get(family.areaId) ?? [];
      list.push(family);
      byArea.set(family.areaId, list);
    }
    return [...byArea.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([areaId, areaFamilies], orderIndex) => {
        const sampleFamilyNames = areaFamilies.slice(0, 4).map((row) => row.name).filter(Boolean);
        const name = catalogAreaDisplayName(areaId);
        const familyIds = new Set(areaFamilies.map((row) => row.familyId));
        const offeringCount = courses.filter((row) => familyIds.has(row.familyId)).length;
        const description = sampleFamilyNames.length
          ? `Includes course types such as ${sampleFamilyNames.join(', ')}.`
          : 'Browse course types in this field of study.';
        const input = {
          areaId,
          name,
          description,
          familyCount: areaFamilies.length,
          sampleFamilyNames,
          offeringCount,
        };
        return {
          entityType: 'area', entityId: areaId, kind: 'program_area_overview',
          displayTitle: name, orderIndex,
          targetJson: JSON.stringify({
            schemaVersion: 1, viewType: 'area', workSetId, entityType: 'area', entityId: areaId,
          }),
          dependencyJson: JSON.stringify(input), inputJson: JSON.stringify(input),
        };
      });
  }
  if (advisor.workKind === 'area_overview') {
    return advisor.presentedFamilyIds
      .map((familyId) => families.find((row) => row.familyId === familyId))
      .filter((row): row is CatalogFamilyView => Boolean(row))
      .map((family, orderIndex) => {
        const input = { ...family, offeringCount: courses.filter((row) => row.familyId === family.familyId).length };
        return {
          entityType: 'family', entityId: family.familyId, kind: 'program_family_overview',
          displayTitle: family.name, orderIndex,
          targetJson: JSON.stringify({ schemaVersion: 1, viewType: 'family', workSetId, entityType: 'family', entityId: family.familyId }),
          dependencyJson: JSON.stringify(input), inputJson: JSON.stringify(input),
        };
      });
  }
  // Chat-only branches (for example compare_families) publish assistant prose without workspace cards.
  if (!advisor.workKind) return [];

  const offeringIds = advisor.presentedOfferingIds.length
    ? advisor.presentedOfferingIds
    : advisor.proposal.offeringIds;
  return offeringIds
    .map((courseId) => courses.find((row) => row.courseId === courseId))
    .filter((row): row is CatalogCourseView => Boolean(row))
    .map((course, orderIndex) => ({
      entityType: 'course', entityId: course.courseId,
      kind: advisor.workKind === 'course_fit_summaries' ? 'course_fit_summary' : 'program_offering',
      displayTitle: course.name, orderIndex,
      targetJson: JSON.stringify({
        schemaVersion: 1, viewType: 'course_summary', workSetId,
        entityType: 'course', entityId: course.courseId, slot: 'summary',
      }),
      dependencyJson: JSON.stringify(advisor.workKind === 'course_fit_summaries' ? {
        profile: advisor.profilePatch,
        course: {
          courseId: course.courseId, institutionId: course.institutionId, institutionName: course.institutionName,
          country: course.country, city: course.city, name: course.name, area: course.area, level: course.level,
          tuitionBand: course.tuitionBand, englishBar: course.englishBar,
        },
      } : { profile: advisor.profilePatch, course }),
      inputJson: JSON.stringify({ ...course, studentPhrase: advisor.profilePatch.studentPhrase, profile: advisor.profilePatch }),
    }));
}

export async function processChatTurn(
  turn: ChatTurn,
  agent: AgentClient,
  coordinator: Coordinator,
  onClaimed?: (attempt: number) => void,
  catalog?: CatalogStore,
): Promise<void> {
  let attempt: number | undefined;
  try {
    attempt = await coordinator.claim(turn);
  } catch {
    return;
  }
  if (attempt === undefined) return;
  onClaimed?.(attempt);

  let sequence = 0;
  const publish = async (payload: TurnUpdatePayload) => {
    if (!coordinator.publishTurnUpdate) return;
    sequence += 1;
    await coordinator.publishTurnUpdate(turn.turnId, attempt!, sequence, payload);
  };

  try {
    await publish({ kind: 'turn_started' });
    const courses = catalog?.listCourses() ?? [];
    const families = catalog?.listFamilies?.() ?? [];
    if (courses.length < MIN_CATALOG_COURSES) {
      const errorCode = 'catalog_unavailable';
      if (coordinator.fail) {
        await coordinator.fail(turn.turnId, attempt, errorCode);
      } else {
        await coordinator.retry(turn.turnId, attempt, errorCode);
      }
      return;
    }
    const profile = turn.profile ?? catalog?.getProfile(turn.conversationId) ?? emptyProfile();
    const selectionContext = turn.selectionContext ?? emptySelection();
    const userMessage: ChatMessage = {
      messageId: turn.userMessageId, conversationId: turn.conversationId, turnId: turn.turnId,
      role: 'user', content: turn.userContent, createdAt: new Date().toISOString(),
    };
    const result = await agent.run([userMessage], turn, {
      profile, uiContext: turn.uiContext, selectionContext,
    });
    catalog?.getUiState?.(turn.conversationId, turn.uiContext.clientInstanceId);
    const advisor = result.advisor
      ?? (result.discovery ? legacyAdvisor(result.content, result.discovery, courses) : safeAdvisorFallback(profile));

    const workItems = buildWorkItems(turn, advisor, courses, families);
    if (workItems.length > 0) {
      await publish({ kind: 'course_search_started', studentPhrase: advisor.profilePatch.studentPhrase || 'your request' });
      const courseIds = workItems.filter((row) => row.entityType === 'course').map((row) => row.entityId);
      await publish({
        kind: 'course_search_results_ready', studentPhrase: advisor.profilePatch.studentPhrase || 'your request',
        matchCount: courseIds.length, courseIds,
      });
    }
    if (coordinator.upsertConversationProfile) {
      await coordinator.upsertConversationProfile(turn.conversationId, advisor.profilePatch);
    }

    await coordinator.complete(turn.turnId, attempt, {
      assistantContent: advisor.assistantContent || result.content,
      runId: result.runId, agentThreadId: result.threadId,
      directiveSchemaVersion: 1, directiveUiRevision: turn.baseUiRevision + 1n,
      directiveType: workItems.length ? 'catalog' : advisor.directive.type,
      directiveAwareness: advisor.directive.awareness,
      workKind: workItems.length ? advisor.workKind : '', workItems,
      expectedContextRevision: turn.baseContextRevision ?? 0n,
      selectionMode: advisor.proposal.mode,
      presentedFamilyIds: advisor.presentedFamilyIds,
      presentedOfferingIds: advisor.presentedOfferingIds,
      provisionalOfferingIds: advisor.proposal.offeringIds,
      proposalRationale: advisor.proposal.rationale,
      comparisonCriterion: advisor.scope?.comparisonCriterion ?? '',
    });
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : 'worker_error';
    try {
      await coordinator.retry(turn.turnId, attempt, errorCode);
    } catch {
      // A newer worker may own the turn after a fenced completion is rejected.
    }
  }
}
