import { describe, expect, it, vi } from 'vitest';
import { processWorkItem } from '../src/services/process-work-item.js';

const item = { workItemId: 'item-1', workSetId: 'set-1', conversationId: 'c1', entityType: 'topic', entityId: 'background', kind: 'prompt', inputJson: '{"title":"Background","detail":"Share your grades."}', attempt: 0, expectedContextRevision: 0n, expectedUiRevision: 1n };

describe('processWorkItem', () => {
  it('claims and commits one bounded result without a transcript operation', async () => {
    const coordinator = { claimWorkItem: vi.fn().mockResolvedValue(1), completeWorkItem: vi.fn(), retryWorkItem: vi.fn() };
    await processWorkItem(item, coordinator);
    expect(coordinator.completeWorkItem).toHaveBeenCalledWith('item-1', 1, expect.stringContaining('Share your grades.'));
  });

  it('retries malformed child input with the active fence', async () => {
    const coordinator = { claimWorkItem: vi.fn().mockResolvedValue(2), completeWorkItem: vi.fn(), retryWorkItem: vi.fn() };
    await processWorkItem({ ...item, inputJson: '{' }, coordinator);
    expect(coordinator.retryWorkItem).toHaveBeenCalledWith('item-1', 2, 'SyntaxError');
  });
});
