import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(import.meta.dirname, '../.env') });

if (!existsSync('coordinator/spacetimedb/Cargo.toml')) throw new Error('coordinator module missing');
const spacetime = process.env.SPACETIME_BIN ?? 'spacetime';
try {
  execFileSync(spacetime, ['build', '--module-path', 'coordinator/spacetimedb'], { stdio: 'inherit' });
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT') || process.env.SPACETIME_BIN) throw error;
  const repositoryRoot = resolve(import.meta.dirname, '..');
  execFileSync('docker', ['run', '--rm', '--user', '0', '-v', `${repositoryRoot}:${repositoryRoot}`, '-w', repositoryRoot, 'clockworklabs/spacetime:v2.0.3', 'build', '--module-path', 'coordinator/spacetimedb'], { stdio: 'inherit' });
}
execFileSync('pnpm', ['--filter', '@study-abroad/spacetimedb-bindings', 'generate'], { stdio: 'inherit' });
