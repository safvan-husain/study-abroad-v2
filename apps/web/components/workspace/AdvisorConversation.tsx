import type { AdvisorMessage, AdvisorTurn } from '../../hooks/useAdvisorWorkspace';

export function AdvisorConversation({ messages, turns }: { messages: AdvisorMessage[]; turns: AdvisorTurn[] }) {
  const latestTurn = [...turns].at(-1);
  return (
    <section className="advisor-conversation" aria-label="Advisor conversation" aria-live="polite">
      {messages.length === 0 ? (
        <div className="advisor-welcome">
          <span className="eyebrow">YOUR STUDY ADVISOR</span>
          <h2>Let us find your direction.</h2>
          <p>Tell me where you are starting from. I will organize the useful next steps in the workspace.</p>
        </div>
      ) : messages.map((message) => (
        <article className={`advisor-message advisor-message-${message.role}`} key={message.messageId}>
          <span>{message.role === 'assistant' ? 'Advisor' : 'You'}</span>
          <p>{message.content}</p>
        </article>
      ))}
      {latestTurn && ['pending', 'claimed', 'retrying'].includes(latestTurn.status) ? (
        <p className="turn-status"><span aria-hidden="true" /> Advisor is preparing your workspace...</p>
      ) : null}
      {latestTurn?.status === 'failed' ? <p className="inline-error">The advisor could not finish that turn. Your message is still saved.</p> : null}
    </section>
  );
}
