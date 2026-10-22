import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const paths = ['api/openapi.json', 'app/src/shared/api/generated.d.ts'];
const before = await Promise.all(paths.map((path) => readFile(path, 'utf8')));
const result = spawnSync('npm', ['run', 'contracts'], { stdio: 'inherit', env: process.env });
if (result.status) process.exit(result.status);
const after = await Promise.all(paths.map((path) => readFile(path, 'utf8')));
if (before.some((value, index) => value !== after[index]))
  throw new Error('Generated contracts changed. Run npm run contracts and include the result.');
console.log('OpenAPI and frontend contracts are current.');
