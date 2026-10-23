import { UnprocessableEntityException } from '@nestjs/common';
import { Worker } from 'node:worker_threads';
export function readStatementWorker<T>(url: URL, data: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    let received = false;
    const worker = new Worker(url, {
      workerData: data,
      resourceLimits: { maxOldGenerationSizeMb: 128 },
    });
    const timer = setTimeout(() => {
      void worker.terminate();
      reject(new UnprocessableEntityException('A leitura excedeu o tempo permitido.'));
    }, 30000);
    worker.once('message', (result) => {
      received = true;
      clearTimeout(timer);
      void worker.terminate();
      if (result.error) reject(new UnprocessableEntityException(result.error));
      else resolve(result);
    });
    worker.once('error', () => {
      clearTimeout(timer);
      reject(
        new UnprocessableEntityException('Falha ao ler o arquivo dentro dos limites permitidos.'),
      );
    });
    worker.once('exit', () => {
      clearTimeout(timer);
      if (!received) reject(new UnprocessableEntityException('A leitura foi interrompida.'));
    });
  });
}
