'use client';

import { useState } from 'react';
import type { AdvisorDirective, AdvisorMessage, AdvisorTurn } from '../../hooks/useAdvisorWorkspace';
import { AdvisorConversation } from './AdvisorConversation';

const suggestions = ['I am unsure what to study', 'Help me describe my background', 'Which details matter most?'];

export function AdvisorRail({ connectionState, error, messages, turns, directive, onSend }: { connectionState: string; error?: string; messages: AdvisorMessage[]; turns: AdvisorTurn[]; directive?: AdvisorDirective; onSend: (content: string) => Promise<void> }) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const submit = async () => {
    const content = draft.trim();
    if (!content || connectionState !== 'ready' || sending) return;
    setSending(true);
    try { await onSend(content); setDraft(''); } finally { setSending(false); }
  };
  return (
    <aside className="advisor-rail" aria-label="Study advisor">
      <header className="advisor-header">
        <div className="advisor-avatar" aria-hidden="true">A</div>
        <div><strong>Amelia</strong><span><i className={connectionState === 'ready' ? 'online' : ''} /> {connectionState === 'ready' ? 'Advisor online' : connectionState}</span></div>
      </header>
      <div className="advisor-scroll">
        <AdvisorConversation messages={messages} turns={turns} />
        <section className="suggestions" aria-label="Suggested questions">
          <span className="eyebrow">TRY ASKING</span>
          {suggestions.map((suggestion) => <button type="button" key={suggestion} onClick={() => setDraft(suggestion)}>{suggestion}<span aria-hidden="true">↗</span></button>)}
        </section>
        {directive ? <section className="active-context"><span className="eyebrow">ACTIVE CONTEXT</span><div><i aria-hidden="true">✦</i><p><strong>Discovery stage</strong>{directive.awareness}</p></div></section> : null}
      </div>
      <div className="composer-wrap">
        {error ? <p className="inline-error" role="alert">{error}</p> : null}
        <label htmlFor="advisor-message">Message your advisor</label>
        <div className="composer">
          <textarea id="advisor-message" value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void submit(); } }} placeholder="Tell me about your goals..." rows={2} disabled={connectionState !== 'ready'} />
          <button type="button" aria-label="Send message" onClick={() => void submit()} disabled={!draft.trim() || connectionState !== 'ready' || sending}>↑</button>
        </div>
        <p className="privacy-note">Your conversation is private and saved to this guest journey.</p>
      </div>
    </aside>
  );
}
