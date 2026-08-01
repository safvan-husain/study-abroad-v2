import 'dotenv/config';
import { InMemoryMongoMessageStore } from '../services/api/src/mongo/message-store.js';
const store = new InMemoryMongoMessageStore(); const conversationId='smoke-conversation', turnId='smoke-turn', correlationId='smoke-correlation';
await store.append({messageId:'user-message',conversationId,turnId,role:'user',content:'Hello',idempotencyKey:'smoke-key'});
await store.append({messageId:'assistant-message',conversationId,turnId,role:'assistant',content:'Hello from the worker.',idempotencyKey:'assistant-smoke-key'});
const messages=await store.list(conversationId); if(messages.length!==2||messages[0].conversationId!==conversationId) throw new Error('smoke correlation failed'); console.log(JSON.stringify({conversationId,turnId,correlationId,messageCount:messages.length,agentServer:'worker boundary fake'}));
