import { z } from 'zod';

export const id = z.string().min(1).max(128).regex(/^[A-Za-z0-9_-]+$/);
export const conversationId = id, messageId = id, turnId = id;
export const chatRole = z.enum(['user', 'assistant']);
export const chatMessage = z.object({ messageId, conversationId, turnId, role: chatRole, content: z.string().trim().min(1).max(16_000), createdAt: z.string().datetime() });
export const messageWrite = chatMessage.omit({ createdAt: true }).extend({ idempotencyKey: id.max(256) });
export const messageRead = z.object({ conversationId, after: z.string().datetime().optional(), limit: z.number().int().min(1).max(100).default(50) });
export type ChatMessage = z.infer<typeof chatMessage>;
export type MessageWrite = z.infer<typeof messageWrite>;
