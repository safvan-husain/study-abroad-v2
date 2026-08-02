import { courseFitResult, type CourseFitResult, type DiscoveryProfilePatch } from '@study-abroad/contracts';
import type { AgentClient } from './agent-server-client.js';

export interface WorkspaceWorkItem {
  workItemId: string;
  workSetId: string;
  conversationId: string;
  entityType: string;
  entityId: string;
  kind: string;
  inputJson: string;
  attempt: number;
  expectedContextRevision: bigint;
  expectedUiRevision: bigint;
}

export interface WorkItemCoordinator {
  claimWorkItem(item: WorkspaceWorkItem): Promise<number | undefined>;
  renewWorkItem?(workItemId: string, attempt: number, leaseSeconds: number): Promise<void>;
  completeWorkItem(workItemId: string, attempt: number, resultJson: string, runId?: string): Promise<void>;
  retryWorkItem(workItemId: string, attempt: number, errorCode: string): Promise<void>;
  failWorkItem?(workItemId: string, attempt: number, errorCode: string): Promise<void>;
}

function fallbackFit(input: Record<string, unknown>): CourseFitResult {
  const name = typeof input.name === 'string' ? input.name : 'Course match';
  const phrase = typeof input.studentPhrase === 'string' ? input.studentPhrase : 'your interests';
  const institutionName = typeof input.institutionName === 'string' ? input.institutionName : '';
  const area = typeof input.area === 'string' ? input.area : '';
  const country = typeof input.country === 'string' ? input.country : '';
  const entityId = typeof input.courseId === 'string' ? input.courseId : '';
  return {
    entityType: 'course',
    entityId,
    title: name,
    detail: `This ${area || 'partner'} programme at ${institutionName || 'a partner university'} in ${country || 'Europe'} is an indicative fit for someone interested in ${phrase}.`,
    institutionName,
    area,
    country,
    studentPhrase: phrase,
  };
}

export async function processWorkItem(
  item: WorkspaceWorkItem,
  coordinator: WorkItemCoordinator,
  onClaimed?: (attempt: number) => void,
  agent?: AgentClient,
): Promise<void> {
  let attempt: number | undefined;
  try {
    attempt = await coordinator.claimWorkItem(item);
  } catch {
    return;
  }
  if (attempt === undefined) return;
  onClaimed?.(attempt);

  try {
    const input = JSON.parse(item.inputJson) as Record<string, unknown>;
    if (item.kind === 'course_fit_summary') {
      const profile = (input.profile && typeof input.profile === 'object'
        ? input.profile
        : {}) as DiscoveryProfilePatch;
      let result = fallbackFit(input);
      if (agent?.runCourseFit) {
        try {
          const remote = await agent.runCourseFit({
            conversationId: item.conversationId,
            correlationId: item.workItemId,
            profile: {
              background: profile.background ?? '',
              courseInterests: profile.courseInterests ?? '',
              ambitions: profile.ambitions ?? '',
              primaryArea: profile.primaryArea ?? '',
              candidateAreas: profile.candidateAreas ?? [],
              studentPhrase: typeof input.studentPhrase === 'string' ? input.studentPhrase : profile.studentPhrase ?? '',
              constraintsText: profile.constraintsText ?? '',
            },
            course: {
              courseId: String(input.courseId ?? item.entityId),
              institutionId: String(input.institutionId ?? ''),
              institutionName: String(input.institutionName ?? ''),
              country: String(input.country ?? ''),
              city: String(input.city ?? ''),
              name: String(input.name ?? 'Course match'),
              area: String(input.area ?? ''),
              level: String(input.level ?? ''),
              tuitionBand: String(input.tuitionBand ?? ''),
              englishBar: String(input.englishBar ?? ''),
              studentPhrase: typeof input.studentPhrase === 'string' ? input.studentPhrase : undefined,
            },
          });
          const parsed = courseFitResult.safeParse(remote.result);
          if (parsed.success) {
            await coordinator.completeWorkItem(item.workItemId, attempt, JSON.stringify(parsed.data), remote.runId);
            return;
          }
        } catch {
          // Fall through to local indicative summary.
        }
      }
      await coordinator.completeWorkItem(item.workItemId, attempt, JSON.stringify(courseFitResult.parse(result)));
      return;
    }

    const result = {
      entityType: item.entityType,
      entityId: item.entityId,
      title: typeof input.title === 'string' ? input.title : 'Advisor note',
      detail: typeof input.detail === 'string' ? input.detail : 'This item is ready for review.',
    };
    await coordinator.completeWorkItem(item.workItemId, attempt, JSON.stringify(result));
  } catch (error) {
    const errorCode = error instanceof Error ? error.name : 'work_item_error';
    try {
      await coordinator.retryWorkItem(item.workItemId, attempt, errorCode);
    } catch {
      // A newer fenced attempt may already own this item.
    }
  }
}
