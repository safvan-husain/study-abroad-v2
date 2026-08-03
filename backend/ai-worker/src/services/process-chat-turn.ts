import {
  type CatalogCourseView,
  type ChatMessage,
  type DiscoveryProfilePatch,
  type DiscoveryTurnResult,
  type TurnUpdatePayload,
  type UserUiState,
  mapPhraseToCatalogAreas,
  rankCoursesForAreas,
  discoveryTurnResult,
} from '@study-abroad/contracts';
import type { AgentClient } from './agent-server-client.js';

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
  getProfile(conversationId: string): DiscoveryProfilePatch | undefined;
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
  uiContext: UserUiState;
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
    background: '',
    courseInterests: '',
    ambitions: '',
    primaryArea: '',
    candidateAreas: [],
    studentPhrase: '',
    constraintsText: '',
  };
}

function buildFallbackDiscovery(userContent: string, catalogAreas: string[], profile: DiscoveryProfilePatch): DiscoveryTurnResult {
  const intent = mapPhraseToCatalogAreas(userContent, catalogAreas);
  const patch = {
    ...profile,
    courseInterests: intent.studentPhrase || profile.courseInterests,
    studentPhrase: intent.studentPhrase || profile.studentPhrase,
    primaryArea: intent.catalogAreas[0] ?? profile.primaryArea,
    candidateAreas: intent.catalogAreas.length ? intent.catalogAreas : profile.candidateAreas,
  };
  if (intent.status === 'mapped') {
    return {
      assistantContent: `Thanks — I am looking through partner courses related to ${intent.studentPhrase} and will organize matches in your workspace.`,
      profilePatch: patch,
      discoveryIntent: intent,
      directive: { type: 'catalog', awareness: `Showing courses related to ${intent.studentPhrase}.` },
      workItems: [],
      workKind: '',
    };
  }
  return {
    assistantContent: `Thanks for sharing. I could not map ${intent.studentPhrase || 'that interest'} to an exact partner-catalogue area yet — tell me more about the subjects or careers you have in mind.`,
    profilePatch: patch,
    discoveryIntent: intent,
    directive: { type: 'discovery', awareness: 'Learning about your background and study interests.' },
    workItems: [],
    workKind: '',
  };
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
    const catalogAreas = [...new Set(courses.map((course) => course.area))];
    const profile = catalog?.getProfile(turn.conversationId) ?? emptyProfile();
    const userMessage: ChatMessage = {
      messageId: turn.userMessageId,
      conversationId: turn.conversationId,
      turnId: turn.turnId,
      role: 'user',
      content: turn.userContent,
      createdAt: new Date().toISOString(),
    };
    const result = await agent.run([userMessage], turn, { catalogAreas, profile, uiContext: turn.uiContext });
    // The graph receives the origin snapshot, while this reread exposes the live tab
    // state to deterministic orchestration. SpacetimeDB still authoritatively fences navigation.
    catalog?.getUiState?.(turn.conversationId, turn.uiContext.clientInstanceId);
    const discovery = result.discovery
      ?? discoveryTurnResult.parse(buildFallbackDiscovery(turn.userContent, catalogAreas, profile));

    const intent = discovery.discoveryIntent;
    let ranked: CatalogCourseView[] = [];
    if (intent.status === 'mapped' && intent.catalogAreas.length > 0) {
      await publish({ kind: 'course_search_started', studentPhrase: intent.studentPhrase });
      ranked = rankCoursesForAreas(courses, intent.catalogAreas, 5);
      await publish({
        kind: 'course_search_results_ready',
        studentPhrase: intent.studentPhrase,
        matchCount: ranked.length,
        courseIds: ranked.map((course) => course.courseId),
      });
    }

    const workSetId = `${turn.turnId}-work`;
    const workItems: WorkItemSpec[] = ranked.map((course, orderIndex) => ({
      entityType: 'course',
      entityId: course.courseId,
      kind: 'course_fit_summary',
      displayTitle: `Comparing ${course.name}`,
      orderIndex,
      targetJson: JSON.stringify({
        schemaVersion: 1,
        viewType: 'course_summary',
        workSetId,
        entityType: 'course',
        entityId: course.courseId,
        slot: 'summary',
      }),
      dependencyJson: JSON.stringify({
        profile: discovery.profilePatch,
        course,
      }),
      inputJson: JSON.stringify({
        courseId: course.courseId,
        institutionId: course.institutionId,
        name: course.name,
        institutionName: course.institutionName,
        country: course.country,
        city: course.city,
        area: course.area,
        level: course.level,
        tuitionBand: course.tuitionBand,
        englishBar: course.englishBar,
        studentPhrase: intent.studentPhrase,
        profile: discovery.profilePatch,
      }),
    }));

    if (coordinator.upsertConversationProfile) {
      await coordinator.upsertConversationProfile(turn.conversationId, discovery.profilePatch);
    }

    const directiveType = ranked.length > 0 ? 'catalog' : discovery.directive.type;
    const awareness = ranked.length > 0
      ? `Showing courses related to ${intent.studentPhrase}.`
      : discovery.directive.awareness;

    await coordinator.complete(turn.turnId, attempt, {
      assistantContent: discovery.assistantContent || result.content,
      runId: result.runId,
      agentThreadId: result.threadId,
      directiveSchemaVersion: 1,
      directiveUiRevision: turn.baseUiRevision + 1n,
      directiveType,
      directiveAwareness: awareness,
      workKind: workItems.length ? 'course_fit_summaries' : '',
      workItems,
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
