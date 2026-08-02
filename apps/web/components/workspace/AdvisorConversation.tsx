import { turnUpdateLabel, type TurnUpdatePayload } from '@study-abroad/contracts';
import type { AdvisorMessage, AdvisorTurn, AdvisorTurnUpdate } from '../../hooks/useAdvisorWorkspace';

function activeUpdates(turns: AdvisorTurn[], updates: AdvisorTurnUpdate[]) {
  const latest = [...turns].at(-1);
  if (!latest) return [];
  return updates
    .filter((update) => update.turnId === latest.turnId && update.attempt === latest.attempt)
    .sort((a, b) => a.sequence - b.sequence || Number(a.updateId - b.updateId));
}

export function AdvisorConversation({
  messages,
  turns,
  turnUpdates = [],
}: {
  messages: AdvisorMessage[];
  turns: AdvisorTurn[];
  turnUpdates?: AdvisorTurnUpdate[];
}) {
  const latestTurn = [...turns].at(-1);
  const inFlight = latestTurn && ['pending', 'claimed', 'retrying'].includes(latestTurn.status);
  const milestones = activeUpdates(turns, turnUpdates);
  const completed = latestTurn?.status === 'completed' && milestones.length > 0;

  return (
    <section className="advisor-conversation" aria-label="Advisor conversation" aria-live="polite">
      {messages.length === 0 ? (
        <div className="advisor-welcome">
          <span className="eyebrow">YOUR STUDY ADVISOR</span>
          <h2>Tell me about your background and interests.</h2>
          <p>
            Share what you have studied so far, and the subjects or careers you want to explore.
            I will use that to search our partner catalogue and organize useful course matches in your workspace.
          </p>
        </div>
      ) : messages.map((message) => (
        <article className={`advisor-message advisor-message-${message.role}`} key={message.messageId}>
          <span>{message.role === 'assistant' ? 'Advisor' : 'You'}</span>
          <p>{message.content}</p>
        </article>
      ))}
      {inFlight || completed ? (
        <section className={`turn-activity${completed ? ' turn-activity-completed' : ''}`} aria-label="Advisor activity">
          <span className="eyebrow">{completed ? 'COMPLETED ACTIVITY' : 'IN PROGRESS'}</span>
          {milestones.length === 0 ? (
            <p className="turn-status"><span aria-hidden="true" /> Advisor is preparing your workspace...</p>
          ) : (
            <ol>
              {milestones.map((update) => (
                <li key={String(update.updateId)}>{turnUpdateLabel(update.payload as TurnUpdatePayload)}</li>
              ))}
            </ol>
          )}
        </section>
      ) : null}
      {latestTurn?.status === 'failed' ? <p className="inline-error">The advisor could not finish that turn. Your message is still saved.</p> : null}
    </section>
  );
}
