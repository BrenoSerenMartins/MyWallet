import { parentPort, workerData } from 'node:worker_threads';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
try {
  const task = getDocument({
    data: new Uint8Array(workerData),
    useSystemFonts: true,
    isEvalSupported: false,
  });
  const pdf = await task.promise;
  if (pdf.numPages > 100) throw new Error('O PDF deve ter no máximo 100 páginas.');
  const pages = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    pages.push(
      content.items
        .filter((i) => 'str' in i && i.str.trim())
        .map((i) => ({
          text: i.str,
          x: Math.round(i.transform[4]),
          y: Math.round(i.transform[5]),
        })),
    );
  }
  await task.destroy();
  parentPort.postMessage({ pages });
} catch {
  parentPort.postMessage({
    error:
      'Não foi possível ler este PDF. Verifique se está protegido, corrompido ou digitalizado.',
  });
}
