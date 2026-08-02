import { DbConnection } from '@study-abroad/spacetimedb-bindings';
import type { ChatMessage } from '@study-abroad/contracts';
import type { CoordinatorPort, TurnStatus } from './coordinator.service.js';

type TurnRow = {
  conversationId: string;
  turnId: string;
  status: string;
  errorCode: string | null;
};

type MessageRow = {
  messageId: string;
  conversationId: string;
  turnId: string;
  sequence: bigint;
  role: 'user' | 'assistant';
  content: string;
  createdAtMicros: bigint;
};

export function toChatMessage(row: MessageRow): ChatMessage {
  return {
    messageId: row.messageId,
    conversationId: row.conversationId,
    turnId: row.turnId,
    role: row.role,
    content: row.content,
    createdAt: new Date(Number(row.createdAtMicros / 1_000n)).toISOString(),
  };
}

/** Browser-facing coordinator port backed by the published SpacetimeDB module. */
export class SpacetimeCoordinatorPort implements CoordinatorPort {
  private connection?: Promise<DbConnection>;
  private readonly correlations = new Map<string, string>();

  private connect() {
    if (this.connection) return this.connection;

    const server = process.env.SPACETIME_URL ?? 'http://localhost:3010';
    const database = process.env.SPACETIME_DATABASE ?? 'study-abroad-coordinator';
    this.connection = new Promise((resolve, reject) => {
      let settled = false;
      const builder = DbConnection.builder()
        .withUri(server.replace(/^http/, 'ws'))
        .withDatabaseName(database)
        .onConnect((connection) => {
          connection.subscriptionBuilder().onApplied(() => {
            if (!settled) {
              settled = true;
              resolve(connection);
            }
          }).subscribe(['SELECT * FROM my_turns', 'SELECT * FROM my_messages']);
        })
        .onConnectError((_context, error) => {
          if (!settled) {
            settled = true;
            reject(error);
          }
        });
      builder.build();
    });

    return this.connection;
  }

  async enqueue(input: { conversationId: string; turnId: string; correlationId: string; content: string }): Promise<TurnStatus> {
    const connection = await this.connect();
    this.correlations.set(`${input.conversationId}:${input.turnId}`, input.correlationId);
    await connection.reducers.ensureGuestJourney({ conversationId: input.conversationId });
    await connection.reducers.sendMessage({
      conversationId: input.conversationId,
      clientCommandId: input.turnId,
      content: input.content,
    });
    return {
      ...input,
      status: 'pending',
    };
  }

  async history(conversationId: string): Promise<ChatMessage[]> {
    const connection = await this.connect();
    return [...(connection.db.my_messages as any).iter()]
      .filter((row: MessageRow) => row.conversationId === conversationId)
      .sort((left: MessageRow, right: MessageRow) => Number(left.sequence - right.sequence))
      .map((row: MessageRow) => toChatMessage(row));
  }

  async status(conversationId: string, turnId: string): Promise<TurnStatus> {
    const connection = await this.connect();
    const row = [...(connection.db.my_turns as any).iter()].find((candidate: TurnRow) =>
      candidate.conversationId === conversationId && candidate.turnId === turnId,
    ) as TurnRow | undefined;
    if (!row) throw new Error('coordinator turn not found');

    const status = row.status === 'completed' ? 'completed' : row.status === 'failed' ? 'failed' : 'pending';
    let error: string | undefined;
    if (status === 'failed' && row.errorCode) {
      error = row.errorCode.slice(0, 128);
    }
    return {
      conversationId,
      turnId,
      correlationId: this.correlations.get(`${conversationId}:${turnId}`) ?? turnId,
      status,
      ...(error ? { error } : {}),
    };
  }
}
