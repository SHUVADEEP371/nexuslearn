import { spawn, spawnSync } from 'node:child_process';
import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const distDirectory = path.join(serverDirectory, 'dist');
const tscCli = path.join(serverDirectory, 'node_modules', 'typescript', 'bin', 'tsc');

await rm(distDirectory, { recursive: true, force: true });
const initialBuild = spawnSync(process.execPath, [tscCli, '--project', 'tsconfig.json'], {
  cwd: serverDirectory,
  stdio: 'inherit',
});

if (initialBuild.error) throw initialBuild.error;
if (initialBuild.status !== 0) process.exit(initialBuild.status ?? 1);

const compiler = spawn(process.execPath, [tscCli, '--watch', '--preserveWatchOutput'], {
  cwd: serverDirectory,
  stdio: 'inherit',
});
const server = spawn(process.execPath, ['--watch', 'dist/index.js'], {
  cwd: serverDirectory,
  stdio: 'inherit',
});
let stopping = false;

function stop(signal) {
  if (stopping) return;
  stopping = true;
  if (compiler.exitCode === null) compiler.kill(signal);
  if (server.exitCode === null) server.kill(signal);
}

process.once('SIGINT', () => stop('SIGINT'));
process.once('SIGTERM', () => stop('SIGTERM'));
compiler.once('error', (error) => {
  console.error('TypeScript watch process failed:', error.message);
  stop('SIGTERM');
  process.exitCode = 1;
});
server.once('error', (error) => {
  console.error('Node watch process failed:', error.message);
  stop('SIGTERM');
  process.exitCode = 1;
});
compiler.once('exit', (code) => {
  if (!stopping) {
    process.exitCode = code && code > 0 ? code : 1;
    stop('SIGTERM');
  }
});

