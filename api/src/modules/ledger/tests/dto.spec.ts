import 'reflect-metadata';
import { expect, it } from 'vitest';
import { validateInput } from '../../../core/http/index.js';
import { TransactionDto } from '../dto/transaction.dto.js';
it('rejects injected ownership and validates required DTO fields', async () => {
  await expect(validateInput(TransactionDto, { userId: 'untrusted' })).rejects.toThrow('campos');
});
