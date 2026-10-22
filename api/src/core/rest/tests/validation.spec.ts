import 'reflect-metadata';
import { expect, it } from 'vitest';
import { dateOnly, exactAmount } from '../index.js';
it('rejects impossible dates and unsafe amounts', () => {
  expect(() => dateOnly('2026-99-99')).toThrow('Data inválida');
  expect(() => dateOnly('2026-02-30')).toThrow('Data inválida');
  expect(dateOnly('2026-02-28')).toBe('2026-02-28');
  expect(() => exactAmount(Number.MAX_SAFE_INTEGER + 1)).toThrow();
});
