import type { ReactNode } from 'react';
import { WorkspaceLiveReplyBar } from './WorkspaceLiveReplyBar';

export function advisorShellClassName(compact: boolean, overlayOpen: boolean) {
  return `advisor-shell${compact ? ' is-compact' : ''}${compact && overlayOpen ? ' workspace-overlay-open' : ''}`;
}

export function workspaceOverlayClassName(overlayOpen: boolean) {
  return `workspace-overlay${overlayOpen ? ' is-open' : ''}`;
}

/** Presentational chat + workspace chrome for desktop side-by-side and compact overlay modes. */
export function AdvisorWorkspaceFrame({
  compact,
  overlayOpen,
  showLiveReply,
  onReturnToChat,
  workspace,
  rail,
}: {
  compact: boolean;
  overlayOpen: boolean;
  showLiveReply: boolean;
  onReturnToChat: () => void;
  workspace: ReactNode;
  rail: ReactNode;
}) {
  return (
    <div className={advisorShellClassName(compact, overlayOpen)}>
      {compact ? rail : workspace}
      {compact ? (
        <div
          className={workspaceOverlayClassName(overlayOpen)}
          aria-hidden={!overlayOpen}
          role="dialog"
          aria-modal={overlayOpen}
          aria-label="Study planning workspace"
        >
          {workspace}
          {showLiveReply ? <WorkspaceLiveReplyBar onReturn={onReturnToChat} /> : null}
        </div>
      ) : rail}
    </div>
  );
}
