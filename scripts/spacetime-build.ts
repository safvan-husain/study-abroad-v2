import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: resolve(import.meta.dirname, '../.env') });

if (!existsSync('coordinator/spacetimedb/Cargo.toml')) throw new Error('coordinator module missing');
const spacetime = process.env.SPACETIME_BIN ?? 'spacetime';
execFileSync(spacetime, ['build', '--module-path', 'coordinator/spacetimedb'], { stdio: 'inherit' });
execFileSync('pnpm', ['--filter', '@study-abroad/spacetimedb-bindings', 'generate'], { stdio: 'inherit' });
