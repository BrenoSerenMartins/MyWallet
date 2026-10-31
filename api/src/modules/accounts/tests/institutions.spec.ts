import 'reflect-metadata';
import { expect, it } from 'vitest';
import { validateInput } from '../../../core/http/index.js';
import { CreateAccountDto } from '../dto/create-account.dto.js';
import { UpdateAccountDto } from '../dto/update-account.dto.js';

it('accepts only mapped institutions on public account creation', async () => {
  for (const institution of ['mercado_pago', 'alelo']) {
    const input = {
      name: 'Minha conta',
      institution,
      type: institution === 'alelo' ? 'benefit_food' : 'checking',
    };
    await expect(validateInput(CreateAccountDto, input)).resolves.toMatchObject(input);
  }
  for (const institution of ['nubank', 'itau', 'inter', 'banco_do_brasil', 'other', 'unknown']) {
    await expect(
      validateInput(CreateAccountDto, { name: 'Conta', institution, type: 'checking' }),
    ).rejects.toThrow();
  }
});

it('retains required fields and ownership protections with inherited creation validation', async () => {
  await expect(
    validateInput(CreateAccountDto, { institution: 'mercado_pago', type: 'checking' }),
  ).rejects.toThrow();
  await expect(
    validateInput(CreateAccountDto, {
      name: 'Conta',
      institution: 'mercado_pago',
      type: 'checking',
      userId: 'injected',
    }),
  ).rejects.toThrow();
});

it('allows legacy institution metadata through update validation for service identity checks', async () => {
  await expect(
    validateInput(UpdateAccountDto, {
      name: 'Nome atualizado',
      institution: 'other',
      type: 'checking',
    }),
  ).resolves.toMatchObject({ institution: 'other' });
});
