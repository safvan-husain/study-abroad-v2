export function toChatMessage(row: {
  messageId: string;
  conversationId: string;
  turnId: string;
  sequence: bigint;
  role: string;
  content: string;
  createdAtMicros: bigint;
}) {
  return {
    messageId: row.messageId,
    conversationId: row.conversationId,
    turnId: row.turnId,
    role: row.role,
    content: row.content,
    createdAt: new Date(Number(row.createdAtMicros / 1_000n)).toISOString(),
  };
}
