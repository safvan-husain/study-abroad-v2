import { Client } from '@langchain/langgraph-sdk';
import type { ChatMessage, DiscoveryTurnResult, CourseFitResult, CatalogCourseView, DiscoveryProfilePatch } from '@study-abroad/contracts';
import { discoveryTurnResult, courseFitResult } from '@study-abroad/contracts';
import type { WorkerConfig } from '../config.js';

export interface AgentTurnResult {
  threadId: string;
  runId: string;
  content: string;
  metadata: Record<string, string>;
  discovery?: DiscoveryTurnResult;
}

export interface AgentCourseFitInput {
  course: CatalogCourseView & { studentPhrase?: string };
  profile: DiscoveryProfilePatch;
  conversationId: string;
  correlationId: string;
}

export interface AgentClient {
  run(
    input: ChatMessage[],
    ids: { conversationId: string; turnId: string; correlationId: string },
    context?: { catalogAreas: string[]; profile: DiscoveryProfilePatch },
  ): Promise<AgentTurnResult>;
  runCourseFit?(input: AgentCourseFitInput): Promise<{ runId: string; result: CourseFitResult }>;
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
    context?: { catalogAreas: string[]; profile: DiscoveryProfilePatch },
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
      profile: context?.profile ?? {},
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
    };
    const last = [...(output.messages ?? [])].reverse().find((message) => message.role === 'ai' || message.type === 'ai');
    if (!runId || !last?.content) throw new Error('Agent Server returned no run or assistant message');
    const parsed = output.discovery_result
      ? discoveryTurnResult.safeParse(output.discovery_result)
      : null;
    return {
      threadId: ids.conversationId,
      runId,
      content: last.content,
      metadata,
      discovery: parsed?.success ? parsed.data : undefined,
    };
  }

  async runCourseFit(input: AgentCourseFitInput): Promise<{ runId: string; result: CourseFitResult }> {
    const assistantId = await this.assistantId();
    const threadId = `${input.conversationId}-fit-${input.course.courseId}`;
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
