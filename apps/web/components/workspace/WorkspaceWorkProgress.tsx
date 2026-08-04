import type { AdvisorCatalogCourse, AdvisorCatalogFamily, AdvisorSelection, AdvisorWorkItem, AdvisorWorkResult, AdvisorWorkSet } from '../../hooks/useAdvisorWorkspace';

type ResultData = Record<string, unknown> & { title?: string; detail?: string; entityType?: string };

function resultData(result: AdvisorWorkResult | undefined): ResultData | undefined {
  if (!result) return undefined;
  try { return JSON.parse(result.resultJson) as ResultData; }
  catch { return { title: 'Advisor note', detail: result.resultJson }; }
}

function jsonArray(value: unknown): Array<Record<string, unknown>> {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed as Array<Record<string, unknown>> : [];
  } catch { return []; }
}

function stringArray(value: unknown): string[] {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch { return []; }
}

function conditionLabel(condition: Record<string, unknown>) {
  const value = condition.numericValue ?? condition.textValue ?? '';
  return `${String(condition.attribute ?? 'Requirement')} ${String(condition.comparisonOperator ?? '')} ${String(value)} ${String(condition.unit ?? '')}`.trim();
}

function OfferingCard({ item, result, selected, onSelect }: { item: AdvisorWorkItem; result?: ResultData; selected: boolean; onSelect: (id: string) => void }) {
  const requirements = jsonArray(result?.requirementsJson);
  const rankings = jsonArray(result?.rankingsJson);
  const sources = jsonArray(result?.sourcesJson);
  const pending = ['pending', 'claimed', 'retrying'].includes(item.status);
  if (!result) {
    return <article className={`work-card work-card-${item.status}`} aria-busy={pending}><div className="work-card-icon">→</div><div><h4>{item.displayTitle}</h4><p>{item.status === 'obsolete' ? 'This result was rejected because newer conversation context exists.' : 'Loading verified offering facts…'}</p></div></article>;
  }
  return (
    <article id={`workspace-item-${item.workItemId}`} className={`work-card offering-card work-card-${item.status}${selected ? ' work-card-selected' : ''}`}>
      <div className="offering-card-head">
        <span>{String(result.qualification || result.level || 'Qualification unavailable')}</span>
        <span>{String(result.ownership || 'Ownership unavailable')}</span>
      </div>
      <h4>{String(result.name || result.title || item.displayTitle)}</h4>
      <p className="work-card-meta">{String(result.institutionName || 'Institution unavailable')} · {String(result.city || 'Location unavailable')}, {String(result.country || 'Country unavailable')}</p>
      {result.detail ? <p>{String(result.detail)}</p> : null}
      <dl className="offering-facts">
        <div><dt>English</dt><dd>{String(result.englishBar || 'Unavailable')}</dd></div>
        <div><dt>Ranking</dt><dd>{rankings.length ? rankings.map((row) => `${String(row.provider)} ${String(row.editionYear)}: ${String(row.rankLabel)}`).join(' · ') : 'Unavailable'}</dd></div>
      </dl>
      <details>
        <summary>Requirements and sources</summary>
        <div className="offering-details">
          <strong>Requirements</strong>
          {requirements.length ? requirements.map((row) => (
            <div key={String(row.requirementId)}><span>{String(row.category).replaceAll('_', ' ')}</span>{jsonArray(row.conditions).map((condition, index) => <small key={index}>{conditionLabel(condition)}</small>)}</div>
          )) : <p>Unavailable</p>}
          <strong>Verified sources</strong>
          {sources.length ? sources.map((row) => <a key={String(row.sourceId)} href={String(row.officialUrl)} target="_blank" rel="noreferrer">{String(row.sourceType).replaceAll('_', ' ')} · verified {String(row.verificationDate)}</a>) : <p>Unavailable</p>}
        </div>
      </details>
      <div className="offering-actions">
        {result.officialUrl ? <a href={String(result.officialUrl)} target="_blank" rel="noreferrer">Official programme ↗</a> : <span>Official link unavailable</span>}
        <button type="button" disabled={selected} onClick={() => onSelect(item.entityId)}>{selected ? 'Selected' : 'Choose course'}</button>
      </div>
    </article>
  );
}

export function WorkspaceWorkProgress({
  workSets, items, results, workSetId, selectedEntityId, catalogFamilies = [], selection,
  onSelectOffering = () => undefined,
}: {
  workSets: AdvisorWorkSet[]; items: AdvisorWorkItem[]; results: AdvisorWorkResult[]; workSetId?: string;
  selectedEntityId?: string; catalogCourses?: AdvisorCatalogCourse[]; catalogFamilies?: AdvisorCatalogFamily[];
  selection?: AdvisorSelection; onSelectOffering?: (offeringId: string) => void;
}) {
  const activeSet = workSets.find((workSet) => workSet.workSetId === workSetId);
  const activeItems = activeSet ? items.filter((item) => item.workSetId === activeSet.workSetId) : [];
  if (!activeSet) return null;
  const familyItems = activeItems.filter((item) => item.kind === 'program_family_overview');
  const offeringItems = activeItems.filter((item) => ['program_offering', 'course_fit_summary'].includes(item.kind));
  const offeringEntries = offeringItems.map((item) => ({ item, data: resultData(results.find((entry) => entry.workItemId === item.workItemId)) }));
  const offeringGroups = [...offeringEntries.reduce((groups, entry) => {
    const familyId = String(entry.data?.familyId ?? 'other');
    const familyName = catalogFamilies.find((family) => family.familyId === familyId)?.name ?? 'Other course types';
    const group = groups.get(familyId) ?? { familyId, familyName, entries: [] as typeof offeringEntries };
    group.entries.push(entry);
    groups.set(familyId, group);
    return groups;
  }, new Map<string, { familyId: string; familyName: string; entries: typeof offeringEntries }>()).values()];
  const otherItems = activeItems.filter((item) => item.kind !== 'program_family_overview' && !['program_offering', 'course_fit_summary'].includes(item.kind));
  const title = activeSet.kind === 'comparison' ? 'University offering comparison' : familyItems.length ? 'Course types in this area' : 'University offerings';
  const selectedIds = new Set([...(selection?.provisionalOfferingIds ?? []), ...(selection?.confirmedOfferingIds ?? [])]);
  const relatedIds = [...new Set(offeringItems.flatMap((item) => {
    const data = resultData(results.find((entry) => entry.workItemId === item.workItemId));
    const family = catalogFamilies.find((row) => row.familyId === String(data?.familyId ?? ''));
    return family ? stringArray(family.relatedFamilyIdsJson) : [];
  }))];
  return (
    <section className="work-progress" aria-labelledby="work-progress-title">
      <div className="section-heading"><div><span className="eyebrow">ADVISOR WORKSPACE</span><h3 id="work-progress-title">{title}</h3></div><span className={`work-set-status status-${activeSet.status}`}>{activeSet.status.replaceAll('_', ' ')}</span></div>
      {familyItems.length ? <div className="work-grid family-grid">{familyItems.map((item) => {
        const result = resultData(results.find((entry) => entry.workItemId === item.workItemId));
        return <article id={`workspace-item-${item.workItemId}`} className={`work-card family-card work-card-${item.status}`} key={item.workItemId}><span className="work-card-label">{Number(result?.offeringCount ?? 0)} university offerings</span><h4>{String(result?.title ?? item.displayTitle)}</h4><p>{String(result?.detail ?? 'Loading the reviewed course-type description…')}</p>{stringArray(result?.typicalSubjects).length ? <p><strong>Typical subjects:</strong> {stringArray(result?.typicalSubjects).join(', ')}</p> : null}{stringArray(result?.careerDirections).length ? <p><strong>Career directions:</strong> {stringArray(result?.careerDirections).join(', ')}</p> : null}</article>;
      })}</div> : null}
      {offeringItems.length ? activeSet.kind === 'comparison' ? (
        <div className="work-grid comparison-grid">{offeringEntries.map(({ item, data }) => <OfferingCard key={item.workItemId} item={item} result={data} selected={selectedIds.has(item.entityId)} onSelect={onSelectOffering} />)}</div>
      ) : offeringGroups.length > 1 ? (
        <div className="offering-family-groups">{offeringGroups.map((group) => <section className="offering-family-group" key={group.familyId} aria-labelledby={`offering-family-${group.familyId}`}>
          <div className="offering-family-heading"><h4 id={`offering-family-${group.familyId}`}>{group.familyName}</h4><span>{group.entries.length} offering{group.entries.length === 1 ? '' : 's'}</span></div>
          <div className="work-grid offering-grid">{group.entries.map(({ item, data }) => <OfferingCard key={item.workItemId} item={item} result={data} selected={selectedIds.has(item.entityId)} onSelect={onSelectOffering} />)}</div>
        </section>)}</div>
      ) : (
        <div className="work-grid offering-grid">{offeringEntries.map(({ item, data }) => <OfferingCard key={item.workItemId} item={item} result={data} selected={selectedIds.has(item.entityId)} onSelect={onSelectOffering} />)}</div>
      ) : null}
      {otherItems.length ? <div className="work-grid">{otherItems.map((item) => {
        const result = resultData(results.find((entry) => entry.workItemId === item.workItemId));
        const pending = ['pending', 'claimed', 'retrying'].includes(item.status);
        return <article key={item.workItemId} className={`work-card work-card-${item.status}`} aria-busy={pending}><div className="work-card-icon">{item.status === 'completed' ? '✓' : '→'}</div><div><h4>{String(result?.title ?? (item.status === 'failed' ? 'Needs another try' : item.displayTitle))}</h4><p>{String(result?.detail ?? (item.status === 'obsolete' ? 'This result no longer matches your current workspace.' : item.status === 'failed' ? 'This item failed without affecting its completed siblings.' : 'This result will appear independently.'))}</p></div></article>;
      })}</div> : null}
      {relatedIds.length ? <div className="related-course-strip"><strong>Related course types</strong>{relatedIds.flatMap((id) => { const family = catalogFamilies.find((row) => row.familyId === id); return family ? [<span key={id}>{family.name}</span>] : []; })}</div> : null}
    </section>
  );
}
