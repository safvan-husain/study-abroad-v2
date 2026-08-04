import { turnUpdateLabel, type TurnUpdatePayload } from '@study-abroad/contracts';
import type { AdvisorMessage, AdvisorTurn, AdvisorTurnUpdate, AdvisorUiAction } from '../../hooks/useAdvisorWorkspace';
import { AdvisorActionCard } from './AdvisorActivities';

function activeUpdates(turns: AdvisorTurn[], updates: AdvisorTurnUpdate[]) {
  const latest = [...turns].at(-1);
  if (!latest) return [];
  return updates.filter((update) => update.turnId === latest.turnId && update.attempt === latest.attempt)
    .sort((a, b) => a.sequence - b.sequence || Number(a.updateId - b.updateId));
}

export function AdvisorConversation({ messages, turns, turnUpdates = [], uiActions = [], onOpenAction = () => undefined }: {
  messages: AdvisorMessage[];
  turns: AdvisorTurn[];
  turnUpdates?: AdvisorTurnUpdate[];
  uiActions?: AdvisorUiAction[];
  onOpenAction?: (action: AdvisorUiAction) => void;
}) {
  const latestTurn = [...turns].at(-1);
  const inFlight = latestTurn && ['pending', 'claimed', 'retrying'].includes(latestTurn.status);
  const milestones = activeUpdates(turns, turnUpdates);
  const events = [
    ...messages.map((message) => ({ kind: 'message' as const, at: message.createdAtMicros, id: message.messageId, message })),
    ...uiActions.map((action) => ({ kind: 'action' as const, at: action.createdAtMicros, id: action.actionId, action })),
  ].sort((a, b) => Number(a.at - b.at) || (a.kind === b.kind ? a.id.localeCompare(b.id) : a.kind === 'message' ? -1 : 1));

  return (
    <section className="advisor-conversation" aria-label="Advisor conversation" aria-live="polite">
      {events.length === 0 ? (
        <div className="advisor-welcome">
          <span className="eyebrow">YOUR STUDY ADVISOR</span>
          <h2>Tell me about your background and interests.</h2>
          <p>Share what you have studied and the subjects or careers you want to explore. I will organize useful course matches in your workspace.</p>
        </div>
      ) : events.map((event) => event.kind === 'message' ? (
        <article className={`advisor-message advisor-message-${event.message.role}`} key={event.id}>
          <span>{event.message.role === 'assistant' ? 'Advisor' : 'You'}</span>
          <p>{event.message.content}</p>
        </article>
      ) : <AdvisorActionCard key={event.id} action={event.action} onOpen={onOpenAction} />)}
      {inFlight ? (
        <section className="turn-activity" aria-label="Advisor activity">
          <span className="eyebrow">IN PROGRESS</span>
          {milestones.length === 0 ? <p className="turn-status"><span aria-hidden="true" /> Advisor is preparing your workspace...</p> : (
            <ol>{milestones.map((update) => <li key={String(update.updateId)}>{turnUpdateLabel(update.payload as TurnUpdatePayload)}</li>)}</ol>
          )}
        </section>
      ) : latestTurn?.status === 'completed' ? (
        <section className="turn-activity turn-activity-completed" aria-label="Advisor activity complete"><p className="turn-status">✓ Done</p></section>
      ) : null}
      {latestTurn?.status === 'failed' ? (
        <p className="inline-error">
          {latestTurn.errorCode === 'catalog_unavailable'
            ? 'The course catalog is not ready yet, so the advisor could not search offerings. Please try again in a moment.'
            : 'The advisor could not finish that turn. Your message is still saved.'}
        </p>
      ) : null}
    </section>
  );
}
