import { messageWrite, type ChatMessage, type MessageWrite } from '@study-abroad/contracts';
export interface MongoMessageStore { append(message: MessageWrite): Promise<ChatMessage>; list(conversationId: string): Promise<ChatMessage[]>; }
export class InMemoryMongoMessageStore implements MongoMessageStore {
  private readonly messages = new Map<string, ChatMessage>();
  private readonly idempotency = new Map<string, string>();

  async append(input: MessageWrite) {
    const parsed = messageWrite.parse(input);
    const existingMessageId = this.idempotency.get(parsed.idempotencyKey);
    const existing = this.messages.get(parsed.messageId) ?? (existingMessageId ? this.messages.get(existingMessageId) : undefined);
    if (existing) {
      if (existing.messageId !== parsed.messageId || existing.conversationId !== parsed.conversationId || existing.turnId !== parsed.turnId || existing.role !== parsed.role || existing.content !== parsed.content) {
        throw new Error("message idempotency conflict");
      }
      return existing;
    }

    const { idempotencyKey, ...messageInput } = parsed;
    const message = { ...messageInput, createdAt: new Date().toISOString() };
    this.messages.set(message.messageId, message);
    this.idempotency.set(idempotencyKey, message.messageId);
    return message;
  }

  async list(conversationId: string) { return [...this.messages.values()].filter(m => m.conversationId === conversationId).sort((a,b) => a.createdAt.localeCompare(b.createdAt)); }
}
