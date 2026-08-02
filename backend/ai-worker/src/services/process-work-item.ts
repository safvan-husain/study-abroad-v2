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

export async function processWorkItem(
  item: WorkspaceWorkItem,
  coordinator: WorkItemCoordinator,
  onClaimed?: (attempt: number) => void,
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
    const input = JSON.parse(item.inputJson) as { title?: unknown; detail?: unknown };
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
