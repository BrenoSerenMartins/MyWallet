import { readdir, readFile } from 'node:fs/promises';
import { resolve, relative, dirname } from 'node:path';
const root = resolve('api/src');
async function files(dir) {
  const results = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) results.push(...(await files(path)));
    else if (path.endsWith('.ts')) results.push(path);
  }
  return results;
}
const errors = [];
for (const path of await files(root)) {
  const local = relative(root, path);
  const source = await readFile(path, 'utf8');
  for (const match of source.matchAll(/(?:from\s*|import\s*)['"](\.[^'"]+)['"]/g)) {
    const target = relative(root, resolve(dirname(path), match[1]));
    const own = /^modules\/([^/]+)/.exec(local)?.[1];
    const other = /^modules\/([^/]+)/.exec(target)?.[1];
    if (local.startsWith('core/') && other) errors.push(`${local}: core depends on ${other}`);
    if (own && other && own !== other && !local.includes('/tests/'))
      errors.push(`${local}: imports another module ${other}`);
    if (other && own !== other && !target.endsWith('/index.js') && !local.includes('/tests/'))
      errors.push(`${local}: bypasses ${other} public exports`);
  }
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
} else console.log('Module boundaries passed.');
