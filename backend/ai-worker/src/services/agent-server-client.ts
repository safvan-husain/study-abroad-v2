import { createHash } from 'node:crypto';
import { Client } from '@langchain/langgraph-sdk';
import type { AdvisorTurnResult, CatalogFamilyView, ChatMessage, DiscoveryTurnResult, CourseFitResult, CatalogCourseView, DiscoveryProfilePatch, UserUiState } from '@study-abroad/contracts';
import { advisorTurnResult, discoveryTurnResult, courseFitResult } from '@study-abroad/contracts';
import type { WorkerConfig } from '../config.js';

export interface AgentTurnResult {
  threadId: string;
  runId: string;
  content: string;
  metadata: Record<string, string>;
  discovery?: DiscoveryTurnResult;
  advisor?: AdvisorTurnResult;
}

export interface AgentSelectionContext {
  presentedFamilyIds: string[];
  presentedOfferingIds: string[];
  provisionalOfferingIds: string[];
  suppressedOfferingIds: string[];
  confirmedOfferingIds: string[];
  comparisonCriterion: string;
  revision: bigint;
}

export interface AgentCourseFitInput {
  course: CatalogCourseView & { studentPhrase?: string };
  profile: DiscoveryProfilePatch;
  conversationId: string;
  correlationId: string;
  uiContext: UserUiState;
}

export interface AgentClient {
  run(
    input: ChatMessage[],
    ids: { conversationId: string; turnId: string; correlationId: string },
    context?: {
      catalogAreas: string[];
      catalogFamilies: CatalogFamilyView[];
      catalogCourses: CatalogCourseView[];
      profile: DiscoveryProfilePatch;
      uiContext: UserUiState;
      selectionContext: AgentSelectionContext;
    },
  ): Promise<AgentTurnResult>;
  runCourseFit?(input: AgentCourseFitInput): Promise<{ runId: string; result: CourseFitResult }>;
}

export function uiContextForGraph(context: UserUiState) {
  return {
    clientInstanceId: context.clientInstanceId,
    target: context.target,
    navigationRevision: context.navigationRevision.toString(),
    visible: context.visible,
    lastSeenAtMicros: context.lastSeenAtMicros.toString(),
  };
}

export function courseFitThreadId(conversationId: string, courseId: string) {
  const characters = createHash('sha256').update(`course-fit\u001f${conversationId}\u001f${courseId}`).digest('hex').slice(0, 32).split('');
  // Agent Server currently validates caller-supplied thread IDs as UUIDv4.
  // The remaining bits stay deterministic so retries address the same thread.
  characters[12] = '4';
  characters[16] = '8';
  const hex = characters.join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export class AgentServerClient implements AgentClient {
  private readonly client: Client;
  private readonly assistants = new Map<string, string>();
  constructor(private readonly config: WorkerConfig, client = new Client({ apiUrl: config.AGENT_SERVER_URL })) {
    this.client = client;
  }

  private async assistantId() {
    const cached = this.assistants.get(this.config.AGENT_GRAPH_ID);
    if (cached) return cached;
    const created = await this.client.assistants.create({ graphId: this.config.AGENT_GRAPH_ID });
    this.assistants.set(this.config.AGENT_GRAPH_ID, created.assistant_id);
    return created.assistant_id;
  }

  async run(
    messages: ChatMessage[],
    ids: { conversationId: string; turnId: string; correlationId: string },
    context?: {
      catalogAreas: string[];
      catalogFamilies: CatalogFamilyView[];
      catalogCourses: CatalogCourseView[];
      profile: DiscoveryProfilePatch;
      uiContext: UserUiState;
      selectionContext: AgentSelectionContext;
    },
  ): Promise<AgentTurnResult> {
    const assistantId = await this.assistantId();
    await this.client.threads.create({
      threadId: ids.conversationId,
      metadata: { conversation_id: ids.conversationId },
      ifExists: 'do_nothing',
    });
    let runId: string | undefined;
    const metadata = {
      conversation_id: ids.conversationId,
      turn_id: ids.turnId,
      correlation_id: ids.correlationId,
      ...(this.config.LANGGRAPH_API_URL ? { LANGGRAPH_API_URL: this.config.LANGGRAPH_API_URL } : {}),
    };
    const input = {
      messages: messages.slice(-1).map(({ content }) => ({ role: 'human', content })),
      catalog_areas: context?.catalogAreas ?? [],
      catalog_families: (context?.catalogFamilies ?? []).map((family) => ({
        ...family,
        aliases: JSON.parse(family.aliasesJson || '[]'),
        typicalSubjects: JSON.parse(family.typicalSubjectsJson || '[]'),
        careerDirections: JSON.parse(family.careerDirectionsJson || '[]'),
        relatedFamilyIds: JSON.parse(family.relatedFamilyIdsJson || '[]'),
      })),
      catalog_courses: context?.catalogCourses ?? [],
      profile: context?.profile ?? {},
      ui_context: context?.uiContext ? uiContextForGraph(context.uiContext) : {},
      selection_context: context?.selectionContext ? {
        ...context.selectionContext,
        revision: context.selectionContext.revision.toString(),
      } : {},
      graph_version: this.config.ADVISOR_GRAPH_VERSION,
      task: 'discover',
      course: {},
    };
    const output = await this.client.runs.wait(ids.conversationId, assistantId, {
      input,
      metadata,
      multitaskStrategy: 'reject',
      onRunCreated: (run) => {
        runId = run.run_id;
      },
    }) as {
      messages?: Array<{ role?: string; type?: string; content?: string }>;
      discovery_result?: unknown;
      advisor_result?: unknown;
    };
    const last = [...(output.messages ?? [])].reverse().find((message) => message.role === 'ai' || message.type === 'ai');
    if (!runId || !last?.content) throw new Error('Agent Server returned no run or assistant message');
    const parsed = output.discovery_result
      ? discoveryTurnResult.safeParse(output.discovery_result)
      : null;
    const parsedAdvisor = output.advisor_result
      ? advisorTurnResult.safeParse(output.advisor_result)
      : null;
    return {
      threadId: ids.conversationId,
      runId,
      content: last.content,
      metadata,
      discovery: parsed?.success ? parsed.data : undefined,
      advisor: parsedAdvisor?.success ? parsedAdvisor.data : undefined,
    };
  }

  async runCourseFit(input: AgentCourseFitInput): Promise<{ runId: string; result: CourseFitResult }> {
    const assistantId = await this.assistantId();
    const threadId = courseFitThreadId(input.conversationId, input.course.courseId);
    await this.client.threads.create({
      threadId,
      metadata: { conversation_id: input.conversationId },
      ifExists: 'do_nothing',
    });
    let runId: string | undefined;
    const output = await this.client.runs.wait(threadId, assistantId, {
      input: {
        messages: [],
        catalog_areas: [],
        profile: input.profile,
        ui_context: uiContextForGraph(input.uiContext),
        task: 'course_fit',
        course: { ...input.course, studentPhrase: input.course.studentPhrase ?? input.profile.studentPhrase },
      },
      metadata: {
        conversation_id: input.conversationId,
        correlation_id: input.correlationId,
        ...(this.config.LANGGRAPH_API_URL ? { LANGGRAPH_API_URL: this.config.LANGGRAPH_API_URL } : {}),
      },
      multitaskStrategy: 'reject',
      onRunCreated: (run) => {
        runId = run.run_id;
      },
    }) as { course_fit_result?: unknown };
    if (!runId) throw new Error('Agent Server returned no course-fit run');
    const parsed = courseFitResult.safeParse(output.course_fit_result);
    if (!parsed.success) {
      return {
        runId,
        result: {
          entityType: 'course',
          entityId: input.course.courseId,
          title: input.course.name,
          detail: `This ${input.course.area} programme at ${input.course.institutionName} is an indicative fit for someone interested in ${input.profile.studentPhrase || 'your interests'}.`,
          institutionName: input.course.institutionName,
          area: input.course.area,
          country: input.course.country,
          studentPhrase: input.profile.studentPhrase,
        },
      };
    }
    return { runId, result: parsed.data };
  }
}
