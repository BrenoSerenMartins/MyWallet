import { readFile, readdir } from 'node:fs/promises';
const values = (await readFile('.env.local', 'utf8').catch(() => ''))
  .split('\n')
  .filter((line) =>
    /^(SUPABASE_DB_PASSWORD|DATABASE_URL|RUNTIME_DATABASE_URL|SUPABASE_ACCESS_TOKEN)=/.test(line),
  )
  .map((line) => line.slice(line.indexOf('=') + 1))
  .filter(Boolean);
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = dir + '/' + e.name;
    if (e.isDirectory()) await walk(path);
    else if (/\.(js|css|html|json)$/.test(path)) {
      const content = await readFile(path, 'utf8');
      if (values.some((secret) => content.includes(secret)))
        throw new Error('A server secret was found in the frontend build.');
    }
  }
}
await walk('app/dist');
console.log('Frontend build contains no configured database credentials.');
