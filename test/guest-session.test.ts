import { describe, expect, it } from 'vitest';
import { GUEST_SESSION_STORAGE_KEY, getOrCreateGuestSessionId } from '../apps/web/lib/guest-session';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  };
}

describe('guest session identity', () => {
  it('uses an existing browser guest identity', () => {
    const storage = createStorage({ [GUEST_SESSION_STORAGE_KEY]: 'existing-guest' });
    expect(getOrCreateGuestSessionId(storage, () => 'new-guest')).toBe('existing-guest');
  });

  it('creates and persists an identity when none exists', () => {
    const storage = createStorage();
    expect(getOrCreateGuestSessionId(storage, () => 'new-guest')).toBe('new-guest');
    expect(storage.getItem(GUEST_SESSION_STORAGE_KEY)).toBe('new-guest');
  });

  it('keeps independent browser storage isolated', () => {
    expect(getOrCreateGuestSessionId(createStorage(), () => 'guest-a')).toBe('guest-a');
    expect(getOrCreateGuestSessionId(createStorage(), () => 'guest-b')).toBe('guest-b');
  });
});
