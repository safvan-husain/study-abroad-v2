import { BadRequestException, Body, Controller, Get, Headers, Inject, Param, Post, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { CoordinatorService } from './coordinator.service.js';
import type { MongoMessageStore } from '../mongo/message-store.js';

@Controller('conversations')
export class CoordinatorController {
  constructor(
    @Inject('MongoMessageStore') private readonly store: MongoMessageStore,
    @Inject(CoordinatorService) private readonly service: CoordinatorService,
  ) {}
  private authorize(userId: string | undefined, conversationId: string) {
    if (!userId) throw new UnauthorizedException('conversation access denied');
    if (!UUID_RE.test(conversationId)) throw new BadRequestException('conversationId must be a UUID');
  }
  @Get(':conversationId/messages') messages(@Headers('x-user-id') userId: string | undefined, @Param('conversationId') conversationId: string) { this.authorize(userId, conversationId); return this.service.getHistory(conversationId); }
  @Post(':conversationId/messages') async send(@Headers('x-user-id') userId: string | undefined, @Param('conversationId') conversationId: string, @Body() body: { content?: string; idempotencyKey?: string }) {
    this.authorize(userId, conversationId);
    if (!body.content?.trim() || !body.idempotencyKey?.trim()) throw new BadRequestException('content and idempotencyKey are required');
    const prior = await this.store.findByIdempotencyKey(body.idempotencyKey);
    const turnId = prior?.turnId ?? randomUUID().replaceAll('-', ''), messageId = prior?.messageId ?? randomUUID().replaceAll('-', ''), correlationId = prior?.turnId ?? randomUUID();
    const message = await this.store.append({ messageId, conversationId, turnId, role: 'user', content: body.content, idempotencyKey: body.idempotencyKey });
    const status = await this.service.createTurn({ conversationId, turnId, correlationId, content: body.content });
    return { message, status };
  }
  @Get(':conversationId/turns/:turnId') status(@Param('conversationId') c: string, @Param('turnId') t: string) { return this.service.getStatus(c, t); }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
