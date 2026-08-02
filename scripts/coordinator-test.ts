import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const repositoryRoot = resolve(import.meta.dirname, '..');
const args = ['test', '--manifest-path', 'coordinator/spacetimedb/Cargo.toml'];
try {
  execFileSync('cargo', args, { cwd: repositoryRoot, stdio: 'inherit' });
} catch (error) {
  if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
  execFileSync('docker', [
    'run', '--rm', '--user', '0', '--entrypoint', '/bin/sh',
    '-v', `${repositoryRoot}:${repositoryRoot}`, '-w', repositoryRoot,
    'clockworklabs/spacetime:v2.0.3', '-c', `cargo ${args.join(' ')}`,
  ], { cwd: repositoryRoot, stdio: 'inherit' });
}
