import type { UiTargetRef } from '@study-abroad/contracts';
import type { AdvisorUiActivity, AdvisorUiActivityReceipt } from '../../hooks/useAdvisorWorkspace';
import { workspaceContainsTarget } from '../../lib/ui-targets';

export function AdvisorActivities({
  activities,
  receipts,
  currentTarget,
  onOpen,
}: {
  activities: AdvisorUiActivity[];
  receipts: AdvisorUiActivityReceipt[];
  currentTarget: UiTargetRef;
  onOpen: (activity: AdvisorUiActivity) => void;
}) {
  const receiptByActivity = new Map(receipts.map((receipt) => [receipt.activityId, receipt.state]));
  const visible = activities.filter((activity) => {
    const receipt = receiptByActivity.get(activity.activityId);
    if (receipt === 'observed_in_place' || receipt === 'dismissed') return false;
    if (workspaceContainsTarget(currentTarget, activity.target)) return false;
    return true;
  });
  if (visible.length === 0) return null;

  return (
    <section className="advisor-activities" aria-label="Workspace updates">
      <span className="eyebrow">WORKSPACE UPDATES</span>
      {visible.map((activity) => {
        const opened = receiptByActivity.get(activity.activityId) === 'opened';
        return (
          <article className={`advisor-activity${opened ? ' advisor-activity-opened' : ''}`} key={activity.activityId}>
            <span aria-hidden="true">✓</span>
            <div>
              <strong>{activity.label}</strong>
              {opened ? <small>Previously opened in your workspace</small> : null}
              <button type="button" onClick={() => onOpen(activity)}>{opened ? 'Open again' : 'Open summary'}</button>
            </div>
          </article>
        );
      })}
    </section>
  );
}
