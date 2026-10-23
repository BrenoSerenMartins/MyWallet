import { parentPort, workerData } from 'node:worker_threads';
import { readTabularFile } from './read-tabular-file.mjs';
try {
  parentPort.postMessage({
    rows: await readTabularFile(Buffer.from(workerData.buffer), workerData.format),
  });
} catch {
  parentPort.postMessage({
    error:
      'Não foi possível ler o CSV/XLSX. Use um extrato de conta Mercado Pago (CSV UTF-8 ou XLSX com uma aba) ou um relatório settlement_v2 em CSV, dentro dos limites permitidos.',
  });
}
