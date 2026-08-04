import { Injectable, OnApplicationShutdown } from '@nestjs/common';
import { DbConnection } from '@study-abroad/spacetimedb-bindings';

@Injectable()
export class SpacetimeUploadService implements OnApplicationShutdown {
  private connection?: DbConnection;
  private readonly ready = this.connect();

  private connect() {
    const uri = (process.env.SPACETIME_URL ?? 'http://localhost:3002').replace(/^http/, 'ws');
    const database = process.env.SPACETIME_DATABASE ?? 'study-abroad-coordinator';
    const username = process.env.AGENT_USERNAME ?? 'study_abroad_agent';
    const password = process.env.AGENT_PASSWORD ?? 'study-agent-dev';
    return new Promise<DbConnection>((resolve, reject) => {
      let settled = false;
      DbConnection.builder().withUri(uri).withDatabaseName(database)
        .onConnect((connection) => {
          this.connection = connection;
          void connection.reducers.login({ username, password })
            .then(() => connection.reducers.registerWorker({ workerLabel: 'document-upload-api' }))
            .then(() => { settled = true; resolve(connection); })
            .catch(reject);
        })
        .onConnectError((_context, error) => { if (!settled) reject(error); })
        .build();
    });
  }

  async consumeTicket(input: { ticketId: string; originalName: string; mimeType: string; byteSize: number; storageKey: string }) {
    const connection = await this.ready;
    await connection.reducers.consumeUploadTicket({
      ticketId: input.ticketId, originalName: input.originalName, mimeType: input.mimeType,
      byteSize: BigInt(input.byteSize), storageKey: input.storageKey,
    });
  }

  async cleanup(beforeMicros: bigint) {
    const connection = await this.ready;
    await connection.reducers.cleanupExpiredDocuments({ beforeMicros });
  }

  onApplicationShutdown() { this.connection?.disconnect(); }
}
