'use client';

import { useState } from 'react';
import type { AdvisorDirective, AdvisorMessage, AdvisorProfile, AdvisorTurn, AdvisorTurnUpdate } from '../../hooks/useAdvisorWorkspace';
import { AdvisorConversation } from './AdvisorConversation';

export function AdvisorRail({
  connectionState,
  error,
  messages,
  turns,
  turnUpdates,
  directive,
  profile,
  onSend,
  onUpdateProfile,
}: {
  connectionState: string;
  error?: string;
  messages: AdvisorMessage[];
  turns: AdvisorTurn[];
  turnUpdates: AdvisorTurnUpdate[];
  directive?: AdvisorDirective;
  profile?: AdvisorProfile;
  onSend: (content: string) => Promise<void>;
  onUpdateProfile: (profile: AdvisorProfile) => Promise<void>;
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
  return (
    <aside className="advisor-rail" aria-label="Study advisor">
      <header className="advisor-header">
        <div className="advisor-avatar" aria-hidden="true">A</div>
        <div><strong>Amelia</strong><span><i className={connectionState === 'ready' ? 'online' : ''} /> {connectionState === 'ready' ? 'Advisor online' : connectionState}</span></div>
      </header>
      <div className="advisor-scroll">
        <AdvisorConversation messages={messages} turns={turns} turnUpdates={turnUpdates} />
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
        {directive ? <section className="active-context"><span className="eyebrow">ACTIVE CONTEXT</span><div><i aria-hidden="true">✦</i><p><strong>{directive.viewType === 'catalog' ? 'Course matches' : 'Discovery stage'}</strong>{directive.awareness}</p></div></section> : null}
      </div>
      <div className="composer-wrap">
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        <label htmlFor="advisor-message">Message your advisor</label>
        <div className="composer">
          <textarea id="advisor-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Describe your background and interests..." rows={2} disabled={connectionState !== 'ready'} />
          <button type="button" aria-label="Send message" onClick={() => void submit()} disabled={!draft.trim() || connectionState !== 'ready' || sending}>↑</button>
        </div>
        <p className="privacy-note">Your conversation is private and saved to this guest journey.</p>
      </div>
    </aside>
  );
}
