import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
dotenv.config({ path: resolve(repoRoot, '.env'), quiet: true });
const configSchema = z.object({
  COORDINATOR_URL: z.string().url().default('http://localhost:3000'),
  AGENT_SERVER_URL: z.string().url().default('http://localhost:2024'),
  AGENT_GRAPH_ID: z.string().default('agent'),
  WORKER_ID: z.string().min(1).default('local-worker'),
  WORKER_LEASE_SECONDS: z.coerce.number().int().positive().default(60),
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional()
});
export type WorkerConfig = z.infer<typeof configSchema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): WorkerConfig => configSchema.parse(env);
