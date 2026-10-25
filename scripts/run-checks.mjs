import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const compiler = require.resolve('typescript/bin/tsc');
const output = mkdtempSync(join(tmpdir(), 'miraflores-checks-'));
function run(args, label) {
  console.log(`\n${label}`);
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: process.env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label} failed${result.status === null ? '' : ` (exit ${result.status})`}.`);
}
try {
  if (!process.argv.includes('--unit-only')) run([compiler, '--noEmit', '--pretty', 'false'], 'Type-check application');
  // A fresh temporary CommonJS package lets the existing test suites run without tsx,
  // import-rewriting packages, an application server, or a paid API request.
  writeFileSync(join(output, 'package.json'), '{"type":"commonjs"}\n');
  run([compiler, 'scripts/test-domain.ts', 'scripts/test-agent.ts', 'scripts/test-records.ts',
    'scripts/test-acceptance.ts', 'scripts/test-workflow-acceptance.ts', 'scripts/test-package-acceptance.ts',
    'scripts/test-checks-acceptance.ts', 'scripts/test-search-acceptance.ts', 'scripts/test-identifiers-acceptance.ts',
    'scripts/test-review-context.ts', 'scripts/test-export-manifest.ts', 'tests/scripts/test-storage.ts', '--outDir', output,
    '--module', 'commonjs', '--moduleResolution', 'node', '--target', 'es2022',
    '--esModuleInterop', '--resolveJsonModule', '--skipLibCheck', '--strict'], 'Compile domain, records, independent acceptance, investigation and private-storage tests');
  run([join(output, 'scripts/test-domain.js')], 'Run domain checks');
  run([join(output, 'scripts/test-agent.js')], 'Run investigation checks (provider calls mocked)');
  run([join(output, 'tests/scripts/test-storage.js')], 'Run local private-storage checks');
  run([join(output, 'scripts/test-records.js')], 'Run CPA records checks');
  run([join(output, 'scripts/test-acceptance.js')], 'Run independent source, calculation graph and masking acceptance');
  run([join(output, 'scripts/test-workflow-acceptance.js')], 'Run independent complete workflow acceptance');
  run([join(output, 'scripts/test-package-acceptance.js')], 'Run independent self-contained package acceptance');
  run([join(output, 'scripts/test-checks-acceptance.js')], 'Run independent source reconciliation acceptance');
  run([join(output, 'scripts/test-search-acceptance.js')], 'Run independent persisted-evidence search acceptance');
  run([join(output, 'scripts/test-identifiers-acceptance.js')], 'Run independent sensitive identifier acceptance');
  run([join(output, 'scripts/test-review-context.js')], 'Run review context, concurrency and request receipt acceptance');
  run([join(output, 'scripts/test-export-manifest.js')], 'Run revision-bound offline export manifest acceptance');
  console.log('\nAll checks passed. No external API requests were made.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Checks failed.');
  process.exitCode = 1;
} finally {
  rmSync(output, { recursive: true, force: true });
}
