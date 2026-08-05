/** Latest assistant message id, or null when none exist. */
export function latestAssistantMessageId(messages: Array<{ messageId: string; role: string }>) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === 'assistant') return messages[index].messageId;
  }
  return null;
}

/** True when a newer assistant message arrived after the baseline captured when the overlay opened. */
export function hasNewAssistantReply(latestId: string | null, baselineId: string | null) {
  return Boolean(latestId && latestId !== baselineId);
}
