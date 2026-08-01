import type { ChatMessage } from '@study-abroad/contracts';
export type TurnStatus = { conversationId: string; turnId: string; status: 'pending'|'completed'|'failed'; correlationId: string; error?: string };
export const apiClient = (baseUrl = process.env.NEXT_PUBLIC_API_URL ?? '/api') => ({
  async history(id: string): Promise<ChatMessage[]> { const r = await fetch(`${baseUrl}/conversations/${id}/messages`, { headers: {'x-user-id': 'browser-user'} }); if (!r.ok) throw new Error('Could not load conversation'); return r.json(); },
  async send(id: string, content: string, idempotencyKey: string): Promise<{ message: ChatMessage; status: TurnStatus }> { const r = await fetch(`${baseUrl}/conversations/${id}/messages`, { method: 'POST', headers: {'content-type':'application/json','x-user-id':'browser-user'}, body: JSON.stringify({ content, idempotencyKey }) }); if (!r.ok) throw new Error('Could not send message'); return r.json(); },
});
