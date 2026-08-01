import { describe, expect, it, vi } from 'vitest';
import { SpacetimeCoordinatorAdapter } from '../src/services/coordinator-adapter.js';

describe('SpacetimeCoordinatorAdapter', () => {
  it('serializes lease durations as u64 values for generated reducers', async () => {
    const claim = vi.fn().mockResolvedValue(undefined);
    const jobs = { subscribe: () => () => undefined, poll: async () => [] };
    const adapter = new SpacetimeCoordinatorAdapter({ reducers: { claim }, db: {} }, jobs, 60);

    await adapter.claim('turn-1', 'worker-1');

    expect(claim).toHaveBeenCalledWith({ turnId: 'turn-1', leaseSeconds: 60n });
  });
});
