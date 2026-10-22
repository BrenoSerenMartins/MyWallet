import { spawn } from 'node:child_process';
const children = ['@mywallet/api', '@mywallet/app'].map((workspace) =>
  spawn('npm', ['run', 'dev', '-w', workspace], { stdio: 'inherit', env: process.env }),
);
function stop() {
  for (const child of children) child.kill('SIGTERM');
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children)
  child.on('exit', (code) => {
    if (code) stop();
  });
