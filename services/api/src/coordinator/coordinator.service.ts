import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
export type TurnStatus = { conversationId: string; turnId: string; status: 'pending'|'completed'|'failed'; correlationId: string; error?: string };
export interface CoordinatorPort { enqueue(input: { conversationId: string; turnId: string; correlationId: string; content: string }): Promise<TurnStatus>; status(conversationId: string, turnId: string): Promise<TurnStatus>; }

@Injectable()
export class CoordinatorService {
  constructor(private readonly coordinator: CoordinatorPort) {}
  async createTurn(input: { conversationId: string; turnId: string; correlationId: string; content: string }) {
    try { return await this.coordinator.enqueue(input); }
    catch (error) { const code = error instanceof Error ? error.message : 'coordinator unavailable';
      if (code.includes('access')) throw new ConflictException('conversation access denied');
      throw new BadRequestException('chat turn could not be queued'); }
  }
  async getStatus(conversationId: string, turnId: string) {
    try { return await this.coordinator.status(conversationId, turnId); }
    catch { throw new NotFoundException('chat turn not found'); }
  }
}
