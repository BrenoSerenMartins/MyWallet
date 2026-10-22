import { expect, it } from 'vitest';
import { parseMoney } from '../money';
it('converts Brazilian monetary input to exact cents', () => {
  expect(parseMoney('1.234,56')).toBe(123456);
  expect(parseMoney('0,01')).toBe(1);
  expect(parseMoney('-0,50')).toBe(-50);
  expect(() => parseMoney('1.23')).toThrow();
  expect(() => parseMoney('12,345')).toThrow();
});
