import { z } from 'zod';
import { id, conversationId, turnId } from './chat.js';
export const jobKind = z.enum(['chat_turn']);
export const jobStatus = z.enum(['pending','claimed','completed','retrying','failed']);
export const dataClass = z.enum(['coordination_reference','access_fact','compact_result']);
export const compactResult = z.object({ dataClass: z.literal('compact_result'), status: z.enum(['completed','retrying','failed']), messageId: id.optional(), agentThreadId: id.optional(), runId: id.optional(), errorCode: z.string().max(64).optional(), summary: z.string().max(512).optional() }).strict();
export const coordinatorJob = z.object({ conversationId, turnId, kind: jobKind, status: jobStatus, idempotencyKey: id.max(256), agentThreadId: id, attempt: z.number().int().min(0).max(20), result: compactResult.optional() }).strict();
export type CoordinatorJob = z.infer<typeof coordinatorJob>;
