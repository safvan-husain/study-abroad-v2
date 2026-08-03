'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { HOME_UI_TARGET, type UiTargetRef, uiTargetRef } from '@study-abroad/contracts';

type WorkspaceHistoryState = {
  workspaceTarget?: UiTargetRef;
  workspaceScrollTop?: number;
};

function historyTarget(state: unknown): UiTargetRef {
  const candidate = (state as WorkspaceHistoryState | null)?.workspaceTarget;
  const parsed = uiTargetRef.safeParse(candidate);
  return parsed.success ? parsed.data : HOME_UI_TARGET;
}

export function useWorkspaceNavigation() {
  const [target, setTarget] = useState<UiTargetRef>(HOME_UI_TARGET);
  const [navigationRevision, setNavigationRevision] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement | null>(null);

  const restoreScroll = useCallback((scrollTop: number) => {
    requestAnimationFrame(() => {
      if (scrollElementRef.current) scrollElementRef.current.scrollTop = scrollTop;
    });
  }, []);

  useEffect(() => {
    const initial = historyTarget(window.history.state);
    const initialScroll = Number((window.history.state as WorkspaceHistoryState | null)?.workspaceScrollTop ?? 0);
    window.history.replaceState({
      ...(window.history.state ?? {}),
      workspaceTarget: initial,
      workspaceScrollTop: initialScroll,
    }, '');
    setTarget(initial);
    restoreScroll(initialScroll);

    const onPopState = (event: PopStateEvent) => {
      const next = historyTarget(event.state);
      const scrollTop = Number((event.state as WorkspaceHistoryState | null)?.workspaceScrollTop ?? 0);
      setTarget(next);
      setNavigationRevision((revision) => revision + 1);
      restoreScroll(scrollTop);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [restoreScroll]);

  const rememberScroll = useCallback(() => {
    const scrollTop = scrollElementRef.current?.scrollTop ?? 0;
    window.history.replaceState({
      ...(window.history.state ?? {}),
      workspaceTarget: target,
      workspaceScrollTop: scrollTop,
    }, '');
  }, [target]);

  const openTarget = useCallback((next: UiTargetRef) => {
    const parsed = uiTargetRef.parse(next);
    rememberScroll();
    window.history.pushState({ workspaceTarget: parsed, workspaceScrollTop: 0 }, '');
    setTarget(parsed);
    setNavigationRevision((revision) => revision + 1);
    restoreScroll(0);
  }, [rememberScroll, restoreScroll]);

  const setScrollElement = useCallback((element: HTMLDivElement | null) => {
    scrollElementRef.current = element;
  }, []);

  return { target, navigationRevision, openTarget, rememberScroll, setScrollElement };
}
