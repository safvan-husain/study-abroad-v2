import { Inject, Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { readdir, stat, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { SpacetimeUploadService } from './spacetime-upload.service.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1_000;

@Injectable()
export class DocumentCleanupService implements OnModuleInit, OnApplicationShutdown {
  private timer?: ReturnType<typeof setInterval>;
  constructor(@Inject(SpacetimeUploadService) private readonly spacetime: SpacetimeUploadService) {}

  onModuleInit() {
    void this.cleanup();
    this.timer = setInterval(() => void this.cleanup(), 60 * 60 * 1_000);
    this.timer.unref?.();
  }

  private async cleanup() {
    const root = process.env.UPLOAD_ROOT ?? '/tmp/study-abroad-uploads';
    const cutoff = Date.now() - SEVEN_DAYS_MS;
    const names = await readdir(root).catch(() => []);
    await Promise.all(names.map(async (name) => {
      const path = join(root, name);
      const details = await stat(path).catch(() => undefined);
      if (details?.isFile() && details.mtimeMs <= cutoff) await unlink(path).catch(() => undefined);
    }));
    await this.spacetime.cleanup(BigInt(Date.now()) * 1_000n).catch(() => undefined);
  }

  onApplicationShutdown() { if (this.timer) clearInterval(this.timer); }
}
