import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
if (args.some((arg) => arg !== '--prepare-only' && !/^--port=\d+$/.test(arg))) {
  console.error('Usage: npm run deploy -- [--prepare-only] [--port=8084]');
  process.exit(1);
}

async function runStage(label, command, arguments_, env = process.env) {
  console.log(`\n${label}`);
  await new Promise((resolve, reject) => {
    const child = spawn(command, arguments_, { cwd: root, env, stdio: 'inherit' });
    const interrupt = () => child.kill('SIGINT');
    const terminate = () => child.kill('SIGTERM');
    process.on('SIGINT', interrupt);
    process.on('SIGTERM', terminate);
    const cleanup = () => {
      process.off('SIGINT', interrupt);
      process.off('SIGTERM', terminate);
    };
    child.once('error', (error) => {
      cleanup();
      reject(error);
    });
    child.once('exit', (code, signal) => {
      cleanup();
      if (code === 0) resolve();
      else reject(new Error(`${label} failed (${signal ?? code}).`));
    });
  });
}

async function assertPortAvailable(port) {
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error('PORT must be an integer between 1 and 65535.');
  await new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', (error) => {
      reject(
        new Error(
          error.code === 'EADDRINUSE'
            ? `Port ${port} is already in use. Stop the existing server or use --port=${port === 8084 ? 8085 : 8084}.`
            : `Cannot check port ${port}: ${error.code}.`,
        ),
      );
    });
    server.listen(port, '0.0.0.0', () =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  });
}

try {
  const settings = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
  const port = Number(
    args.find((arg) => arg.startsWith('--port='))?.slice(7) ??
      settings.PORT ??
      process.env.PORT ??
      8083,
  );
  if (!args.includes('--prepare-only')) await assertPortAvailable(port);
  await runStage('Validate code and build application', 'npm', ['run', 'verify']);
  await runStage('Apply migrations and verify database TLS/runtime role', 'npm', [
    'run',
    'db:setup',
  ]);
  if (!args.includes('--prepare-only')) {
    // Setup may have created the runtime credential. Load its updated value.
    const settings = parseEnv(await readFile(new URL('../.env.local', import.meta.url), 'utf8'));
    await runStage('Start production application', process.execPath, ['api/dist/main.js'], {
      ...process.env,
      ...settings,
      PORT: String(port),
      NODE_ENV: 'production',
      STATIC_DIRECTORY: fileURLToPath(new URL('../app/dist', import.meta.url)),
    });
  }
} catch (error) {
  console.error(
    error.code === 'ENOENT' ? 'Deployment requires .env.local and npm ci.' : error.message,
  );
  process.exitCode = 1;
}
