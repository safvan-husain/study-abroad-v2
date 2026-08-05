'use client';

import { useCallback, useSyncExternalStore } from 'react';

export const COMPACT_VIEWPORT_QUERY = '(max-width: 1023px)';

function subscribeCompact(onStoreChange: () => void, query: string) {
  const media = window.matchMedia(query);
  media.addEventListener('change', onStoreChange);
  return () => media.removeEventListener('change', onStoreChange);
}

/** True for phones and tablets (< 1024px). Uses the client media query after mount. */
export function useCompactViewport(query = COMPACT_VIEWPORT_QUERY) {
  const subscribe = useCallback((onStoreChange: () => void) => subscribeCompact(onStoreChange, query), [query]);
  const getSnapshot = useCallback(() => window.matchMedia(query).matches, [query]);
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
