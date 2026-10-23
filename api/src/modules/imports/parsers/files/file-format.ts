import { UnprocessableEntityException } from '@nestjs/common';
import { extname } from 'node:path';
export type StatementFileFormat = 'pdf' | 'csv' | 'xlsx';
export function statementFileFormat(buffer: Buffer, filename: string): StatementFileFormat {
  if (!buffer.length || buffer.length > 10 * 1024 * 1024)
    throw new UnprocessableEntityException('O arquivo deve ter conteúdo e até 10 MB.');
  const extension = extname(filename).toLowerCase();
  const pdf = buffer.subarray(0, 5).toString() === '%PDF-';
  const zip = buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04]));
  if (extension === '.pdf' && pdf) return 'pdf';
  if (extension === '.xlsx' && zip) return 'xlsx';
  if (extension === '.csv' && !pdf && !zip && !buffer.includes(0)) return 'csv';
  throw new UnprocessableEntityException(
    'Selecione um extrato de conta Mercado Pago em PDF, CSV ou XLSX. A extensão deve corresponder ao conteúdo.',
  );
}
