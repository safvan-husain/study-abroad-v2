import { messageWrite, type ChatMessage, type MessageWrite } from '@study-abroad/contracts';
import { Collection, MongoClient } from 'mongodb';
export interface MongoMessageStore {
  append(message: MessageWrite): Promise<ChatMessage>;
  list(conversationId: string): Promise<ChatMessage[]>;
  findByIdempotencyKey(key: string): Promise<ChatMessage | undefined>;
}
export class MongoMessageStoreImpl implements MongoMessageStore {
  private readonly client: MongoClient;
  private readonly database: string;
  private collection?: Collection<ChatMessage & { idempotencyKey: string }>;
  constructor(uri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017', database = process.env.MONGODB_DATABASE ?? 'study_abroad') {
    this.client = new MongoClient(uri);
    this.database = database;
  }
  private async messages() { if (!this.collection) { await this.client.connect(); this.collection = this.client.db(this.database).collection('messages'); } return this.collection; }
  async append(input: MessageWrite) { const parsed = messageWrite.parse(input); const c = await this.messages(); const old = await c.findOne({ $or: [{ messageId: parsed.messageId }, { idempotencyKey: parsed.idempotencyKey }] }); if (old) return old; const message = { ...parsed, createdAt: new Date().toISOString() }; await c.insertOne(message); return message; }
  async list(conversationId: string) { return cSort(await (await this.messages()).find({ conversationId }).toArray()); }
  async findByIdempotencyKey(key: string) { return (await (await this.messages()).findOne({ idempotencyKey: key })) ?? undefined; }
}
function cSort(messages: ChatMessage[]) { return messages.sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
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
  async findByIdempotencyKey(key: string) { const messageId = this.idempotency.get(key); return messageId ? this.messages.get(messageId) : undefined; }
}

export class ConversationAccess {
  canRead(userId: string, conversationId: string) { return userId.length > 0 && conversationId.length > 0; }
}
