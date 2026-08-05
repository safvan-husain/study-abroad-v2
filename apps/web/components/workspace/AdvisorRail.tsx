'use client';

import { useState } from 'react';
import { catalogAreaDisplayName } from '@study-abroad/contracts';
import type { AdvisorCatalogCourse, AdvisorCatalogFamily, AdvisorDirective, AdvisorMessage, AdvisorProfile, AdvisorSelection, AdvisorSelectionRevision, AdvisorTurn, AdvisorTurnUpdate, AdvisorUiAction } from '../../hooks/useAdvisorWorkspace';
import { AdvisorConversation } from './AdvisorConversation';

export function AdvisorRail({
  connectionState,
  error,
  messages,
  turns,
  turnUpdates,
  uiActions = [],
  directive,
  profile,
  selection,
  selectionRevisions = [],
  catalogCourses = [],
  catalogFamilies = [],
  onSend,
  onUpdateProfile,
  onOpenAction = () => undefined,
  onRemoveOffering = async () => undefined,
  onRemoveSelectedFamily = async () => undefined,
  onRestoreRevision = async () => undefined,
  onConfirmSelection = async () => undefined,
  onEditConfirmedSelection = async () => undefined,
}: {
  connectionState: string;
  error?: string;
  messages: AdvisorMessage[];
  turns: AdvisorTurn[];
  turnUpdates: AdvisorTurnUpdate[];
  uiActions: AdvisorUiAction[];
  directive?: AdvisorDirective;
  profile?: AdvisorProfile;
  selection?: AdvisorSelection;
  selectionRevisions?: AdvisorSelectionRevision[];
  catalogCourses?: AdvisorCatalogCourse[];
  catalogFamilies?: AdvisorCatalogFamily[];
  onSend: (content: string) => Promise<void>;
  onUpdateProfile: (profile: AdvisorProfile) => Promise<void>;
  onOpenAction: (action: AdvisorUiAction) => void;
  onRemoveOffering?: (offeringId: string) => Promise<void>;
  onRemoveSelectedFamily?: (familyId: string) => Promise<void>;
  onRestoreRevision?: (revision: bigint) => Promise<void>;
  onConfirmSelection?: () => Promise<void>;
  onEditConfirmedSelection?: () => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingInterests, setEditingInterests] = useState(false);
  const [interestDraft, setInterestDraft] = useState('');
  const submit = async () => {
    const content = draft.trim();
    if (!content || connectionState !== 'ready' || sending) return;
    setSending(true);
    try { await onSend(content); setDraft(''); } finally { setSending(false); }
  };
  const saveInterests = async () => {
    if (!profile) return;
    await onUpdateProfile({ ...profile, studentPhrase: interestDraft.trim() });
    setEditingInterests(false);
  };
  const provisional = (selection?.provisionalOfferingIds ?? []).flatMap((id) => {
    const course = catalogCourses.find((row) => row.courseId === id);
    return course ? [course] : [];
  });
  const selectedFamilies = (selection?.selectedFamilyIds ?? []).flatMap((id) => {
    const family = catalogFamilies.find((row) => row.familyId === id);
    return family ? [family] : [];
  });
  const confirmed = Boolean(selection?.confirmedOfferingIds.length);
  const latestRestorable = selectionRevisions.find((row) => ['user_removal', 'agent_replacement', 'restore_revision'].includes(row.source));
  const contextFamilies = (selection?.presentedFamilyIds ?? []).flatMap((id) => {
    const family = catalogFamilies.find((row) => row.familyId === id);
    return family ? [family.name] : [];
  });
  const contextAreas = [...new Set((selection?.presentedFamilyIds ?? []).flatMap((id) => {
    const family = catalogFamilies.find((row) => row.familyId === id);
    return family?.areaId ? [catalogAreaDisplayName(family.areaId)] : [];
  }))];
  const contextUniversities = [...new Set((selection?.presentedOfferingIds ?? []).flatMap((id) => {
    const course = catalogCourses.find((row) => row.courseId === id);
    return course ? [course.institutionName] : [];
  }))];
  return (
    <aside className="advisor-rail" aria-label="Study advisor">
      <header className="advisor-header">
        <div className="advisor-avatar" aria-hidden="true">A</div>
        <div><strong>Amelia</strong><span><i className={connectionState === 'ready' ? 'online' : ''} /> {connectionState === 'ready' ? 'Advisor online' : connectionState}</span></div>
      </header>
      <div className="advisor-scroll">
        <AdvisorConversation messages={messages} turns={turns} turnUpdates={turnUpdates} uiActions={uiActions} onOpenAction={onOpenAction} />
        {profile && (profile.studentPhrase || profile.primaryArea || profile.background) ? (
          <section className="interest-panel" aria-label="What we understand about you">
            <span className="eyebrow">WHAT WE UNDERSTAND</span>
            {!editingInterests ? (
              <div>
                {profile.studentPhrase ? <p><strong>Interests:</strong> {profile.studentPhrase}</p> : null}
                {profile.primaryArea ? <p><strong>Catalogue area:</strong> {profile.primaryArea}</p> : null}
                {profile.background ? <p><strong>Background:</strong> {profile.background}</p> : null}
                <button type="button" onClick={() => { setInterestDraft(profile.studentPhrase); setEditingInterests(true); }}>Correct interests</button>
              </div>
            ) : (
              <div>
                <label htmlFor="interest-correction">Your interests</label>
                <textarea id="interest-correction" value={interestDraft} onChange={(event) => setInterestDraft(event.target.value)} rows={2} />
                <div className="interest-actions">
                  <button type="button" onClick={() => void saveInterests()}>Save</button>
                  <button type="button" onClick={() => setEditingInterests(false)}>Cancel</button>
                </div>
              </div>
            )}
          </section>
        ) : null}
        {directive ? <section className="active-context"><span className="eyebrow">ACTIVE CONTEXT</span><div><i aria-hidden="true">✦</i><p><strong>{directive.viewType === 'catalog' ? 'Course matches' : 'Explore stage'}</strong>{directive.awareness}</p></div></section> : null}
      </div>
      <div className="composer-wrap">
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        {contextFamilies.length || contextUniversities.length || selection?.comparisonCriterion ? (
          <div className="context-chips" aria-label="Conversation context">
            {contextFamilies.slice(0, 3).map((name) => <span key={`family-${name}`}>{name}</span>)}
            {contextUniversities.slice(0, 3).map((name) => <span key={`university-${name}`}>{name}</span>)}
            {selection?.comparisonCriterion ? <span>Compare: {selection.comparisonCriterion}</span> : null}
          </div>
        ) : null}
        <label htmlFor="advisor-message">Message your advisor</label>
        <div className="composer">
          <div className="composer-row">
            <textarea id="advisor-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Describe your background and interests..." rows={2} disabled={connectionState !== 'ready'} />
            <button type="button" aria-label="Send message" onClick={() => void submit()} disabled={!draft.trim() || connectionState !== 'ready' || sending}>↑</button>
          </div>
          {contextAreas.length ? (
            <div className="composer-area-badge" aria-label="Catalogue area">
              {contextAreas.slice(0, 2).map((name) => <span key={`area-${name}`}>{name}</span>)}
            </div>
          ) : null}
        </div>
        {selectedFamilies.length ? (
          <section className="provisional-selection" aria-label="Selected course types">
            <div><strong>Selected course types</strong><span>{selectedFamilies.length}/4</span></div>
            {selectedFamilies.map((family) => (
              <p key={family.familyId}><span>{family.name}<small>Course type</small></span><button type="button" aria-label={`Remove ${family.name}`} onClick={() => void onRemoveSelectedFamily(family.familyId)}>×</button></p>
            ))}
          </section>
        ) : null}
        {provisional.length ? (
          <section className="provisional-selection" aria-label="Provisional course selection">
            <div><strong>{confirmed ? 'Confirmed courses' : 'Provisional courses'}</strong><span>{provisional.length}/5</span></div>
            {provisional.map((course) => (
              <p key={course.courseId}><span>{course.name}<small>{course.institutionName}</small></span>{!confirmed ? <button type="button" aria-label={`Remove ${course.name}`} onClick={() => void onRemoveOffering(course.courseId)}>×</button> : <i aria-label="Confirmed">✓</i>}</p>
            ))}
            <div className="selection-actions">
              {!confirmed ? <button type="button" onClick={() => void onConfirmSelection()}>Confirm selection</button> : <button type="button" onClick={() => void onEditConfirmedSelection()}>Edit and reconfirm</button>}
              {!confirmed && latestRestorable ? <button type="button" onClick={() => void onRestoreRevision(latestRestorable.revision)}>Restore previous</button> : null}
            </div>
          </section>
        ) : null}
        <p className="privacy-note">Your conversation is private and saved to this guest journey.</p>
      </div>
    </aside>
  );
}
