import type { AdvisorUiAction } from '../../hooks/useAdvisorWorkspace';

export function AdvisorActionCard({ action, onOpen }: { action: AdvisorUiAction; onOpen: (action: AdvisorUiAction) => void }) {
  const opened = action.status === 'applied' || action.status === 'opened';
  return (
    <article className={`advisor-activity${opened ? ' advisor-activity-opened' : ''}`} data-action-id={action.actionId}>
      <span aria-hidden="true">✓</span>
      <div>
        <strong>{action.label}</strong>
        {opened ? <small>Available in your workspace</small> : null}
        <button type="button" onClick={() => onOpen(action)}>{opened ? 'Open again' : action.buttonLabel}</button>
      </div>
    </article>
  );
}
