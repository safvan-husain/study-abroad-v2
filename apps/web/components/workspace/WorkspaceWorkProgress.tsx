import type { AdvisorWorkItem, AdvisorWorkResult, AdvisorWorkSet } from '../../hooks/useAdvisorWorkspace';

function resultText(result: AdvisorWorkResult | undefined) {
  if (!result) return undefined;
  try {
    return JSON.parse(result.resultJson) as {
      title?: string;
      detail?: string;
      institutionName?: string;
      area?: string;
      country?: string;
    };
  } catch {
    return { title: 'Advisor note', detail: result.resultJson };
  }
}

export function WorkspaceWorkProgress({ workSets, items, results, workSetId, selectedEntityId }: { workSets: AdvisorWorkSet[]; items: AdvisorWorkItem[]; results: AdvisorWorkResult[]; workSetId?: string; selectedEntityId?: string }) {
  const activeSet = workSets.find((workSet) => workSet.workSetId === workSetId);
  const activeItems = activeSet ? items.filter((item) => item.workSetId === activeSet.workSetId) : [];
  if (!activeSet) return null;
  const courseItems = activeItems.filter((item) => item.kind === 'course_fit_summary');
  const heading = courseItems.length > 0 ? 'Course matches for you' : 'Your next steps';
  return (
    <section className="work-progress" aria-labelledby="work-progress-title">
      <div className="section-heading">
        <div><span className="eyebrow">ADVISOR WORKSPACE</span><h3 id="work-progress-title">{heading}</h3></div>
        <span className={`work-set-status status-${activeSet.status}`}>{activeSet.status.replaceAll('_', ' ')}</span>
      </div>
      <div className="work-grid">
        {[...activeItems].sort((left, right) => left.orderIndex - right.orderIndex).map((item) => {
          const result = resultText(results.find((entry) => entry.workItemId === item.workItemId));
          const isCourse = item.kind === 'course_fit_summary';
          return (
            <article id={`workspace-item-${item.workItemId}`} className={`work-card work-card-${item.status}${isCourse ? ' work-card-course' : ''}${selectedEntityId === item.entityId ? ' work-card-selected' : ''}`} key={item.workItemId} aria-busy={['pending', 'claimed', 'retrying'].includes(item.status)}>
              <div className="work-card-icon" aria-hidden="true">{item.status === 'completed' ? '✓' : '→'}</div>
              <div>
                <span className="work-card-label">{isCourse ? (result?.area ?? item.entityId.replaceAll('-', ' ')) : item.entityId.replaceAll('-', ' ')}</span>
                <h4>{result?.title ?? (item.status === 'failed' ? 'Needs another try' : item.displayTitle)}</h4>
                {result?.institutionName ? <p className="work-card-meta">{result.institutionName}{result.country ? ` · ${result.country}` : ''}</p> : null}
                <p>{result?.detail ?? (item.status === 'obsolete' ? 'This result no longer matches your current workspace.' : item.status === 'failed' ? 'This item failed without affecting the other completed steps.' : isCourse ? 'A personalized fit note will appear here independently.' : 'This result will appear here independently as soon as it is ready.')}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
