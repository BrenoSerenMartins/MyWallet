import { cp, mkdir } from 'node:fs/promises';
const target = 'dist/modules/imports/parsers/mercado-pago';
await mkdir(target, { recursive: true });
await cp('src/modules/imports/parsers/mercado-pago/pdf-worker.mjs', target + '/pdf-worker.mjs');
