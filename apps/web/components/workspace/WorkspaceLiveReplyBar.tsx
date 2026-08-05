export function WorkspaceLiveReplyBar({ onReturn }: { onReturn: () => void }) {
  return (
    <button type="button" className="workspace-live-reply" onClick={onReturn}>
      <span>
        <strong>Advisor replied — back to chat</strong>
        <span>A new message is waiting in the conversation.</span>
      </span>
      <em aria-hidden="true">Open</em>
    </button>
  );
}
