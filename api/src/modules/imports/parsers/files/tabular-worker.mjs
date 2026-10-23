import { parentPort, workerData } from 'node:worker_threads';
import { readTabularFile } from './read-tabular-file.mjs';
try {
  parentPort.postMessage({
    rows: await readTabularFile(Buffer.from(workerData.buffer), workerData.format),
  });
} catch {
  parentPort.postMessage({
    error:
      'Não foi possível ler o CSV/XLSX. Use o relatório de extrato de conta Mercado Pago, em UTF-8 para CSV ou com uma única aba no XLSX, dentro dos limites permitidos.',
  });
}
