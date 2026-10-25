import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const [major, minor] = process.versions.node.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 13)) {
  console.error('Miraflores local preview requires Node.js 22.13 or newer for the SQLite runtime.');
  process.exit(1);
}
const args = process.argv.slice(2);
if (args.some(arg => arg !== '--production')) {
  console.error('Usage: npm run start:local [-- --production]');
  process.exit(1);
}
const mode = args.includes('--production') ? 'start' : 'dev';
console.log(`Miraflores local preview: http://127.0.0.1:3000 (${mode}). Local persona access is enabled for this process.`);
const child = spawn(process.execPath, [require.resolve('next/dist/bin/next'), mode, '--hostname', '127.0.0.1', '--port', '3000'], {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, MIRAFLORES_LOCAL_PREVIEW: '1' },
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', error => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal === 'SIGINT' ? 130 : signal === 'SIGTERM' ? 143 : 1);
});
