import { describe, expect, it } from 'vitest';
import {
  GUEST_SESSION_STORAGE_KEY,
  SPACETIMEDB_TOKEN_STORAGE_KEY,
  UI_CLIENT_STORAGE_KEY,
  getOrCreateGuestSessionId,
  resetGuestAccount,
} from '../apps/web/lib/guest-session';

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => { values.delete(key); },
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

  it('clears guest identity, SpacetimeDB token, and tab client id on reset', () => {
    const local = createStorage({
      [GUEST_SESSION_STORAGE_KEY]: 'guest-1',
      [SPACETIMEDB_TOKEN_STORAGE_KEY]: 'token-1',
    });
    const session = createStorage({ [UI_CLIENT_STORAGE_KEY]: 'tab-1' });
    resetGuestAccount(local, session);
    expect(local.getItem(GUEST_SESSION_STORAGE_KEY)).toBeNull();
    expect(local.getItem(SPACETIMEDB_TOKEN_STORAGE_KEY)).toBeNull();
    expect(session.getItem(UI_CLIENT_STORAGE_KEY)).toBeNull();
  });
});
