import { expect, it } from 'vitest';
import { counterpartyRecognition } from '../services/counterparty-recognition.js';
import {
  comparableCounterpartyIdentifier,
  normalizeCounterpartyIdentifier,
  type CounterpartySnapshot,
} from '../../../core/integration/index.js';
function snapshot(): CounterpartySnapshot {
  return {
    agents: [
      { id: 'maria', name: 'Maria Oliveira', enabled: true, version: 1 },
      { id: 'jose', name: 'José D’Ávila', enabled: true, version: 1 },
      { id: 'generic', name: 'Mercado', enabled: true, version: 1 },
      { id: 'disabled', name: 'Pessoa Desativada', enabled: false, version: 1 },
    ],
    identifiers: [
      {
        id: 'alias',
        counterpartyId: 'maria',
        accountId: 'account',
        sourceKind: 'account_statement',
        value: 'Pix recebido Maria Oliveira',
        enabled: true,
      },
    ],
    rules: [],
  };
}
it('folds Portuguese text and punctuation without altering persisted keys or merchant IDs', () => {
  expect(comparableCounterpartyIdentifier(' PIX — recebido:  JOSÉ D’ÁVILA! ')).toBe(
    'pix recebido jose d avila',
  );
  expect(comparableCounterpartyIdentifier('JOSÉ')).toBe(
    comparableCounterpartyIdentifier('JOSE\u0301'),
  );
  expect(normalizeCounterpartyIdentifier('JOSÉ')).toBe('josé');
  expect(comparableCounterpartyIdentifier(' Loja-A ', 'store_id')).toBe('Loja-A');
});
it('recognizes confirmed aliases with typography changes but only suggests a different payment description', () => {
  const recognition = counterpartyRecognition(snapshot(), 'account', 'account_statement');
  expect(recognition.identify('PIX RECEBIDO: MARIA-OLIVEIRA')).toBe('maria');
  expect(recognition.identify('Pagamento no cartão Maria Oliveira')).toBeNull();
  expect(recognition.candidates('Pagamento no cartão Maria Oliveira')).toEqual([
    { counterpartyId: 'maria', name: 'Maria Oliveira', reason: 'name' },
  ]);
  expect(
    counterpartyRecognition(snapshot(), 'other', 'account_statement').identify(
      'Pix recebido Maria Oliveira',
    ),
  ).toBeNull();
  expect(
    counterpartyRecognition(snapshot(), 'account', 'manual').identify(
      'Pix recebido Maria Oliveira',
    ),
  ).toBeNull();
});
it('suggests abbreviated, omitted and slightly misspelled names without recognizing them automatically', () => {
  const recognition = counterpartyRecognition(snapshot(), 'account', 'account_statement');
  for (const description of ['Pix de M. Oliveira', 'Crédito Maria Oliv', 'Cartão Maria Oliviera']) {
    expect(recognition.identify(description)).toBeNull();
  }
  expect(recognition.candidates('Pix de M. Oliveira')[0]?.reason).toBe('abbreviation');
  expect(recognition.candidates('Crédito Maria Oliv')[0]?.reason).toBe('abbreviation');
  expect(recognition.candidates('Cartão Maria Oliveir')[0]?.counterpartyId).toBe('maria');
  expect(recognition.candidates('Cartão Maria Oliviera')[0]?.reason).toBe('similar_description');
  expect(recognition.candidates('Cartão Maria Oliveire')[0]?.reason).toBe('similar_description');
});
it('does not suggest generic terms, operation IDs, short partial names or disabled identities', () => {
  const recognition = counterpartyRecognition(snapshot(), 'account', 'account_statement');
  for (const description of [
    'Pix recebido',
    'Pagamento no mercado',
    'Pix recebido 123456789',
    'Pix Maria',
    'Pagamento Pessoa Desativada',
    'Pagamento Mariana Oliveira',
  ])
    expect(recognition.candidates(description)).toEqual([]);
});
it('preserves ambiguity between canonical aliases and same-name people', () => {
  const state = snapshot();
  state.agents.push({ id: 'other-maria', name: 'Maria Oliveira', enabled: true, version: 1 });
  state.identifiers.push({
    ...state.identifiers[0],
    id: 'collision',
    counterpartyId: 'other-maria',
    value: 'PIX recebido Mária-Oliveira',
  });
  const recognition = counterpartyRecognition(state, 'account', 'account_statement');
  expect(recognition.identify('Pix recebido Maria Oliveira')).toBeNull();
  expect(
    new Set(
      recognition
        .candidates('Pagamento Maria Oliveira')
        .map((candidate) => candidate.counterpartyId),
    ),
  ).toEqual(new Set(['maria', 'other-maria']));
});
