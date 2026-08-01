import type { ChatMessage, MessageWrite } from '@study-abroad/contracts';
import type { MongoMessageStore } from '../../../../services/api/src/mongo/message-store.js';
export interface WorkerMessageStore extends MongoMessageStore {}
export { InMemoryMongoMessageStore } from '../../../../services/api/src/mongo/message-store.js';
export type { ChatMessage, MessageWrite };
