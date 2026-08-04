import dotenv from 'dotenv';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';

const repoRoot = resolve(fileURLToPath(new URL('../../../', import.meta.url)));
dotenv.config({ path: resolve(repoRoot, '.env'), quiet: true });
const configSchema = z.object({
  SPACETIME_URL: z.string().url().default('http://localhost:3010'),
  SPACETIME_DATABASE: z.string().min(1).default('study-abroad-coordinator'),
  AGENT_USERNAME: z.string().min(1).default('study_abroad_agent'),
  AGENT_PASSWORD: z.string().min(1).default('study-agent-dev'),
  AGENT_SERVER_URL: z.string().url().default('http://localhost:2025'),
  LANGGRAPH_API_URL: z.string().url().optional(),
  AGENT_GRAPH_ID: z.string().default('agent'),
  ADVISOR_GRAPH_VERSION: z.enum(['legacy', 'specialist']).default('specialist'),
  WORKER_ID: z.string().min(1).default('local-worker'),
  WORKER_LEASE_SECONDS: z.coerce.number().int().positive().default(60),
  LANGSMITH_TRACING: z.string().optional(),
  LANGSMITH_PROJECT: z.string().optional()
});
export type WorkerConfig = z.infer<typeof configSchema>;
export const loadConfig = (env: NodeJS.ProcessEnv = process.env): WorkerConfig => configSchema.parse(env);
