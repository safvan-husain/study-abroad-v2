import { MongoClient } from 'mongodb';
import { messageWrite, type ChatMessage, type MessageWrite } from '@study-abroad/contracts';
export interface WorkerMessageStore { append(message: MessageWrite): Promise<ChatMessage>; list(conversationId: string): Promise<ChatMessage[]>; }
export class MongoMessageStore implements WorkerMessageStore {
  private readonly client = new MongoClient(process.env.MONGODB_URI ?? 'mongodb://localhost:27017');
  private async collection() { await this.client.connect(); return this.client.db(process.env.MONGODB_DATABASE ?? 'study_abroad').collection<ChatMessage & { idempotencyKey: string }>('messages'); }
  async append(input: MessageWrite) { const parsed = messageWrite.parse(input); const c = await this.collection(); const old = await c.findOne({ $or: [{ messageId: parsed.messageId }, { idempotencyKey: parsed.idempotencyKey }] }); if (old) return old; const message = { ...parsed, createdAt: new Date().toISOString() }; await c.insertOne(message); return message; }
  async list(conversationId: string) { return (await (await this.collection()).find({ conversationId }).toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)); }
}
export class InMemoryMongoMessageStore implements WorkerMessageStore { private readonly items = new Map<string, ChatMessage>(); async append(input: MessageWrite) { const p = messageWrite.parse(input); const old = this.items.get(p.messageId); if (old) return old; const m = { ...p, createdAt: new Date().toISOString() }; this.items.set(m.messageId, m); return m; } async list(id: string) { return [...this.items.values()].filter(m => m.conversationId === id); } }
export type { ChatMessage, MessageWrite };
