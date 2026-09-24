import { readFile, mkdir, stat, rename, rm } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve } from 'node:path';

const run = promisify(execFile);
const [manifestPath, directory] = process.argv.slice(2);
if (!manifestPath || !directory) throw new Error('Usage: node scripts/download-archive.mjs <manifest.json> <raw-directory>');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
await mkdir(directory, { recursive: true });
const failures = [];
// Deliberately sequential: be gentle with the archive, cache completed requests,
// and never replace a usable download with a partial file from a failed request.
for (const entry of manifest) {
  if (!/^[a-z0-9-]+$/.test(entry.source) || !/^[a-z0-9-]+$/.test(entry.slug)) throw new Error('Invalid archive filename');
  const path = resolve(directory, `${entry.source}--${entry.slug}.html`);
  if (await stat(path).then((s) => s.size > 0).catch(() => false)) continue;
  const candidate = entry.candidates[0];
  if (!/^\d{14}$/.test(candidate.timestamp) || !/^https?:\/\//.test(candidate.url)) throw new Error('Invalid snapshot');
  try {
    await run('curl', ['--fail', '--location', '--retry', '3', '--retry-all-errors', '--retry-delay', '3', '--max-time', '60', '--silent', '--show-error',
      `https://web.archive.org/web/${candidate.timestamp}/${candidate.url}`, '--output', path + '.tmp']);
    await rename(path + '.tmp', path);
    console.log(entry.slug);
  } catch (error) {
    failures.push(entry.slug);
    console.error(`${entry.slug}: ${error.message}`);
    await rm(path + '.tmp', { force: true });
  }
  await new Promise((resolve) => setTimeout(resolve, 1500));
}
if (failures.length) throw new Error(`${failures.length} downloads failed. Rerun to resume.`);
