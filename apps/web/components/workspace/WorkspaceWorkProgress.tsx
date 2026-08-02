import type { AdvisorWorkItem, AdvisorWorkResult, AdvisorWorkSet } from '../../hooks/useAdvisorWorkspace';

function resultText(result: AdvisorWorkResult | undefined) {
  if (!result) return undefined;
  try {
    return JSON.parse(result.resultJson) as { title?: string; detail?: string };
  } catch {
    return { title: 'Advisor note', detail: result.resultJson };
  }
}

export function WorkspaceWorkProgress({ workSets, items, results }: { workSets: AdvisorWorkSet[]; items: AdvisorWorkItem[]; results: AdvisorWorkResult[] }) {
  const activeSet = workSets.at(-1);
  const activeItems = activeSet ? items.filter((item) => item.workSetId === activeSet.workSetId) : [];
  if (!activeSet) return null;
  return (
    <section className="work-progress" aria-labelledby="work-progress-title">
      <div className="section-heading">
        <div><span className="eyebrow">ADVISOR WORKSPACE</span><h3 id="work-progress-title">Your next steps</h3></div>
        <span className={`work-set-status status-${activeSet.status}`}>{activeSet.status.replaceAll('_', ' ')}</span>
      </div>
      <div className="work-grid">
        {activeItems.map((item) => {
          const result = resultText(results.find((entry) => entry.workItemId === item.workItemId));
          return (
            <article className={`work-card work-card-${item.status}`} key={item.workItemId} aria-busy={['pending', 'claimed', 'retrying'].includes(item.status)}>
              <div className="work-card-icon" aria-hidden="true">{item.status === 'completed' ? '✓' : '→'}</div>
              <div>
                <span className="work-card-label">{item.entityId.replaceAll('-', ' ')}</span>
                <h4>{result?.title ?? (item.status === 'failed' ? 'Needs another try' : 'Preparing this step')}</h4>
                <p>{result?.detail ?? (item.status === 'obsolete' ? 'This result no longer matches your current workspace.' : item.status === 'failed' ? 'This item failed without affecting the other completed steps.' : 'This result will appear here independently as soon as it is ready.')}</p>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
