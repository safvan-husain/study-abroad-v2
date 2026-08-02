export const GUEST_SESSION_STORAGE_KEY = 'study-abroad-guest-session-id';

type StorageLike = Pick<Storage, 'getItem' | 'setItem'>;

export function createGuestSessionId() {
  const webCrypto = globalThis.crypto;
  if (typeof webCrypto?.randomUUID === 'function') return webCrypto.randomUUID();

  const bytes = webCrypto?.getRandomValues
    ? webCrypto.getRandomValues(new Uint8Array(16))
    : Uint8Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function getOrCreateGuestSessionId(
  storage: StorageLike,
  createId: () => string = createGuestSessionId,
) {
  const storedId = storage.getItem(GUEST_SESSION_STORAGE_KEY)?.trim();
  if (storedId) return storedId;

  const guestSessionId = createId();
  storage.setItem(GUEST_SESSION_STORAGE_KEY, guestSessionId);
  return guestSessionId;
}
