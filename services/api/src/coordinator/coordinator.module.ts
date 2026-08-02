import { Module } from '@nestjs/common';
import { InMemoryMongoMessageStore, MongoMessageStoreImpl } from '../mongo/message-store.js';
import { CoordinatorController } from './coordinator.controller.js';
import { CoordinatorService, type CoordinatorPort } from './coordinator.service.js';
import { SpacetimeCoordinatorPort } from './spacetime-coordinator.js';
const statuses = new Map<string, ReturnType<CoordinatorPort['enqueue']>>();
const fake: CoordinatorPort = { async enqueue(i) { const result = { conversationId: i.conversationId, turnId: i.turnId, correlationId: i.correlationId, status: 'pending' as const }; statuses.set(`${i.conversationId}:${i.turnId}`, Promise.resolve(result)); return result; }, async history() { return []; }, async status(c, t) { const result = await statuses.get(`${c}:${t}`); if (!result) throw new Error('not found'); return result; } };
@Module({ controllers: [CoordinatorController], providers: [{ provide: 'MongoMessageStore', useFactory: () => process.env.IN_MEMORY_SERVICES === 'true' ? new InMemoryMongoMessageStore() : new MongoMessageStoreImpl() }, { provide: CoordinatorService, useFactory: () => new CoordinatorService(process.env.USE_LIVE_COORDINATOR === 'true' ? new SpacetimeCoordinatorPort() : fake) }], exports: [CoordinatorService] })
export class CoordinatorModule {}
