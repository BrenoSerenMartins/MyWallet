import { test, expect, type Page } from '@playwright/test';
const user = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'pilot@example.test',
  user_metadata: { full_name: 'Piloto' },
  aud: 'authenticated',
  created_at: '2026-01-01T00:00:00Z',
};
const workspace = {
  id: '44444444-4444-4444-8444-444444444444',
  name: 'Pessoal',
  description: 'Minhas finanças pessoais',
  color: 'emerald',
  isDefault: true,
};
const account = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Meu Mercado Pago',
  institution: 'mercado_pago',
  type: 'checking',
  currency: 'BRL',
  openingBalance: 10000,
  openingDate: '2026-01-01',
  balance: 345678,
  version: 1,
  archived: false,
};
const transaction = {
  id: '33333333-3333-4333-8333-333333333333',
  accountId: account.id,
  categoryId: null,
  transactionDate: '2026-10-01',
  description: 'Compra de supermercado com uma descrição bastante longa para testar o layout',
  amount: -12590,
  transactionType: 'expense',
  version: 1,
  importBatchId: null,
  transferGroupId: null,
};
async function signedIn(page: Page) {
  await page.addInitScript(
    ({ user }) => {
      const session = {
        access_token: 'synthetic-test-token',
        refresh_token: 'synthetic-refresh',
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        expires_in: 3600,
        token_type: 'bearer',
        user,
      };
      localStorage.setItem('sb-hlcrjoqmyohfbajvafhh-auth-token', JSON.stringify(session));
      localStorage.setItem('mywallet-theme', 'dark');
      localStorage.setItem('mywallet-workspace:' + user.id, '44444444-4444-4444-8444-444444444444');
    },
    { user },
  );
  await page.route('https://*.supabase.co/**', (route) => route.fulfill({ json: { user } }));
  await page.route('**/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === '/v1/workspaces') data = [workspace];
    else if (path === '/v1/accounts') data = [account];
    else if (path === '/v1/categories') data = [];
    else if (path === '/v1/transactions') data = { items: [transaction], nextCursor: null };
    else if (path === '/v1/dashboard')
      data = {
        balance: 345678,
        income: 1000000,
        expense: 654322,
        unclassified: 0,
        accounts: [account],
        coverage: 'tracked-accounts',
      };
    return route.fulfill({ json: data });
  });
}
test('sign-in themes and accessible form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bom ter você por aqui.' })).toBeVisible();
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Começar agora' }).click();
  await expect(page.getByRole('heading', { name: 'Seu próximo passo começa aqui.' })).toBeVisible();
});
for (const width of [360, 390, 768, 1440])
  test(`responsive pilot at ${width}px`, async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Um bom dia/ })).toBeVisible();
    await expect(page.getByText('R$ 3.456,78').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Ocultar valores' }).click();
    await expect(page.locator('.hero-balance')).toHaveText('••••••');
    await page.goto('/accounts');
    await expect(page.getByRole('heading', { name: 'Minhas contas', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByLabel('Saldo inicial (R$)')).toHaveCount(0);
    await expect(page.getByRole('dialog').getByLabel('Data inicial')).toHaveCount(0);
    await page.getByRole('dialog').getByLabel('Nome da conta').fill('Nova conta');
    await page.getByRole('button', { name: 'Tema claro', exact: true }).isVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goto('/transactions');
    await expect(page.getByRole('button', { name: /Compra de supermercado/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/imports');
    await expect(page.getByRole('heading', { name: /Seus movimentos/ })).toBeVisible();
    await page.getByLabel('Conta de destino').selectOption(account.id);
    await expect(page.getByRole('button', { name: 'Selecionar extratos' })).toBeEnabled();
    await page.goto('/settings');
    await expect(page.getByRole('heading', { name: 'Preferências', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Tema claro', exact: true }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    await page.screenshot({ path: `/tmp/mywallet-settings-${width}.png`, fullPage: true });
    await page.goto('/workspaces');
    await expect(page.getByRole('heading', { name: 'Seus espaços.' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/mywallet-spaces-${width}.png`, fullPage: true });
    await page.goto('/');
    await page.screenshot({ path: `/tmp/mywallet-dashboard-${width}.png`, fullPage: true });
  });

test('workspace cards open a space and creation uses its scope', async ({ page }) => {
  await signedIn(page);
  await page.route('**/v1/workspaces', async (route) => {
    if (route.request().method() === 'POST') {
      const body = route.request().postDataJSON();
      return route.fulfill({
        json: { id: '55555555-5555-4555-8555-555555555555', ...body, isDefault: false },
      });
    }
    return route.fulfill({ json: [workspace] });
  });
  await page.goto('/workspaces');
  await expect(page.getByRole('heading', { name: 'Seus espaços.' })).toBeVisible();
  await page.getByRole('link', { name: 'Abrir espaço Pessoal' }).click();
  await expect(page.getByRole('heading', { name: /Um bom dia/ })).toBeVisible();
  await page.getByRole('link', { name: 'Trocar de espaço', exact: true }).first().click();
  await page.getByRole('button', { name: 'Criar espaço', exact: true }).click();
  await page.getByLabel('Nome do espaço').fill('Meu negócio');
  await page.getByRole('button', { name: 'Azul', exact: true }).click();
  const selectedRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/v1/dashboard') &&
      request.headers()['x-workspace-id'] === '55555555-5555-4555-8555-555555555555',
  );
  await page.getByRole('button', { name: 'Criar e abrir espaço' }).click();
  await selectedRequest;
  await expect(page.getByRole('heading', { name: /Um bom dia/ })).toBeVisible();
  const scope = await page.evaluate(() =>
    localStorage.getItem('mywallet-workspace:11111111-1111-4111-8111-111111111111'),
  );
  expect(scope).toBe('55555555-5555-4555-8555-555555555555');
});

const planningIncomeId = '66666666-6666-4666-8666-666666666666';
const planningExpenseId = '77777777-7777-4777-8777-777777777777';
function monthlyPlan(month: string, version = 1) {
  return {
    month,
    version,
    notes: 'Uma intenção para o mês.',
    contribution: 10000,
    lines: [
      {
        categoryId: planningIncomeId,
        difference: -20000,
        name: 'Salário',
        type: 'income',
        color: '#5ee9b5',
        planned: 300000,
        actual: 280000,
        transactionCount: 1,
        archived: false,
      },
      {
        categoryId: planningExpenseId,
        difference: -5000,
        name: 'Alimentação',
        type: 'expense',
        color: '#f08080',
        planned: 50000,
        actual: 55000,
        transactionCount: 3,
        archived: false,
      },
    ],
    totals: {
      incomeDifference: -20000,
      expenseDifference: -5000,
      resultDifference: -25000,
      plannedIncome: 300000,
      plannedExpense: 50000,
      actualIncome: 280000,
      actualExpense: 55000,
      plannedResult: 250000,
      actualResult: 225000,
      afterContribution: 240000,
      missingCategoryCount: 0,
      unclassifiedCount: 0,
      unclassifiedInflow: 0,
      unclassifiedOutflow: 0,
    },
  };
}
for (const width of [360, 1440])
  test(`monthly planning save, copy and themes at ${width}px`, async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    const month = '2026-02';
    let plan = monthlyPlan(month);
    let saved = false;
    await page.route('**/v1/planning/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path.endsWith('/copies')) {
        expect(request.postDataJSON()).toEqual({ version: 2, sourceVersion: 1 });
        plan = { ...monthlyPlan(month, 3), notes: plan.notes };
        return route.fulfill({ json: plan });
      }
      if (request.method() === 'PUT') {
        const body = request.postDataJSON();
        expect(
          body.lines.find((l: { categoryId: string }) => l.categoryId === planningExpenseId).amount,
        ).toBe(60000);
        expect(body.version).toBe(1);
        expect(request.headers()['x-workspace-id']).toBe(workspace.id);
        saved = true;
        plan = {
          ...plan,
          version: 2,
          notes: body.notes,
          lines: plan.lines.map((l) => ({
            ...l,
            planned: l.categoryId === planningExpenseId ? 60000 : l.planned,
          })),
          totals: {
            ...plan.totals,
            plannedExpense: 60000,
            plannedResult: 240000,
            afterContribution: 230000,
          },
        };
      }
      return route.fulfill({ json: path.endsWith('/2026-01') ? monthlyPlan('2026-01') : plan });
    });
    await page.goto('/planning');
    await page.getByLabel('Mês do planejamento').fill(month);
    await expect(
      page.getByRole('heading', { name: 'Planejamento mensal', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('-R$ 50,00', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Editar planejamento', exact: true }).click();
    await page.getByLabel('Previsto · Alimentação').fill('600,00');
    await page.getByLabel('Notas do mês').fill('Notas preservadas');
    await page.getByRole('button', { name: 'Salvar planejamento', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(saved).toBe(true);
    await expect(page.getByText('Notas preservadas', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Copiar mês anterior', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('substituídos');
    await page.getByRole('button', { name: 'Confirmar cópia do planejamento' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/mywallet-planning-${width}.png`, fullPage: true });
  });

test('old statement can be retained for consultation and searched without confirming transactions', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  const id = '88888888-8888-4888-8888-888888888888';
  let history = false;
  const batch = {
    id,
    accountId: account.id,
    fileName: 'synthetic-history.pdf',
    status: 'draft',
    version: 1,
    accountOpeningDate: '2026-10-23',
    statementStartDate: '2026-01-01',
    openingDateMismatch: true,
    openingMismatch: true,
    recordedOpeningBalance: 0,
    openingBalance: 10000,
    closingBalance: 9000,
    items: [
      {
        ...transaction,
        id: '99999999-9999-4999-8999-999999999999',
        sourceRow: 1,
        balanceAfter: 9000,
        selected: true,
        duplicateCandidate: false,
        sourceOperationId: 'source-ref',
        amount: -1000,
        transactionDate: '2026-01-01',
      },
    ],
  };
  await page.route(`**/v1/imports/${id}**`, async (route) => {
    if (route.request().method() === 'POST') {
      expect(new URL(route.request().url()).pathname).toBe(`/v1/imports/${id}/history`);
      history = true;
      batch.status = 'history';
      batch.version = 2;
    }
    return route.fulfill({ json: batch });
  });
  await page.goto(`/imports/${id}`);
  await page.getByText(/^Arquivo e conciliação/).click();
  await expect(
    page.getByText('Diferença no histórico · a importação pode continuar'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar 1 movimento' })).toBeEnabled();
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByText('Guardar apenas para consulta', { exact: true }).click();
  await page.getByRole('button', { name: 'Salvar apenas como histórico' }).click();
  await expect(page.getByText('Histórico para consulta · não afeta seus saldos')).toBeVisible();
  expect(history).toBe(true);
  await page.getByRole('searchbox', { name: 'Buscar no extrato' }).fill('does-not-exist');
  await expect(page.getByText(transaction.description, { exact: true })).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Buscar no extrato' }).fill('2026-01-01');
  await expect(page.getByText(transaction.description, { exact: true })).toBeVisible();
});

test('CSV statement upload uses the same review and history workflow', async ({ page }) => {
  await signedIn(page);
  const batch = {
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    accountId: account.id,
    fileName: 'synthetic.csv',
    status: 'draft',
    sourceFormat: 'csv',
    version: 1,
    accountOpeningDate: '2026-01-01',
    statementStartDate: '2026-10-01',
    openingDateMismatch: false,
    openingMismatch: false,
    recordedOpeningBalance: 10000,
    openingBalance: 10000,
    closingBalance: 9000,
    items: [
      {
        ...transaction,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        sourceRow: 5,
        amount: -1000,
        balanceAfter: 9000,
        selected: true,
        duplicateCandidate: false,
        sourceOperationId: '123456',
      },
    ],
  };
  await page.route('**/v1/imports', async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().headers()['content-type']).toContain('multipart/form-data');
      expect(route.request().postData()).toContain('filename="synthetic.csv"');
      return route.fulfill({ json: batch, status: 201 });
    }
    return route.fulfill({ json: [] });
  });
  await page.route(`**/v1/imports/${batch.id}`, (route) => route.fulfill({ json: batch }));
  await page.goto('/imports');
  await page.getByLabel('Conta de destino').selectOption(account.id);
  await expect(page.locator('input[type=file]')).toHaveAttribute('accept', /\.csv.*\.xlsx/);
  await page.locator('input[type=file]').setInputFiles({
    name: 'synthetic.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE\n100,00;0,00;-10,00;90,00\n\nRELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE\n01-10-2026;Pagamento;123456;-10,00;90,00',
    ),
  });
  await expect(page.getByRole('heading', { name: 'Revise seu extrato' })).toBeVisible();
  await expect(page.getByText(/Arquivo e conciliação · CSV/)).toBeVisible();
  await page.getByText('Guardar apenas para consulta', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar apenas como histórico' })).toBeVisible();
});

test('batch uploads run sequentially, keep successful files after errors and link repeated results', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  let count = 0,
    active = 0,
    maximum = 0;
  let releaseFirst!: () => void;
  const first = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });
  await page.route('**/v1/imports', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    count++;
    active++;
    maximum = Math.max(maximum, active);
    expect(route.request().headers()['x-workspace-id']).toBe(workspace.id);
    expect(route.request().postData()).toContain(account.id);
    if (count === 1) await first;
    active--;
    if (count === 2)
      return route.fulfill({ status: 422, json: { title: 'Relatório de teste não suportado.' } });
    return route.fulfill({ status: 201, json: { id, status: 'draft' } });
  });
  await page.goto('/imports');
  await page.getByLabel('Conta de destino').selectOption(account.id);
  await page.locator('input[type=file]').setInputFiles([
    { name: 'month.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-synthetic') },
    {
      name: 'invalid.xlsx',
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: Buffer.from('synthetic'),
    },
    { name: 'same-month.csv', mimeType: 'text/csv', buffer: Buffer.from('synthetic') },
  ]);
  await expect(page.getByText('Lendo e conferindo…', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Conta de destino')).toBeDisabled();
  expect(count).toBe(1);
  releaseFirst();
  const results = page.getByRole('region', { name: 'Resultado do envio de extratos' });
  await expect(
    results.getByText('Relatório de teste não suportado.', { exact: true }),
  ).toBeVisible();
  await expect(results.getByText('Mesmo extrato de outro arquivo deste lote')).toBeVisible();
  await expect(results.getByRole('link', { name: 'Revisar', exact: true })).toHaveCount(2);
  expect(count).toBe(3);
  expect(maximum).toBe(1);
  await expect(page).toHaveURL(/\/imports$/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mywallet-batch-390.png', fullPage: true });
});

test('stopping the queue finishes only the active file and skips the remaining files', async ({
  page,
}) => {
  await signedIn(page);
  let count = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/imports', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    count++;
    await pending;
    return route.fulfill({
      status: 201,
      json: { id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', status: 'draft' },
    });
  });
  await page.goto('/imports');
  await page.getByLabel('Conta de destino').selectOption(account.id);
  await page.locator('input[type=file]').setInputFiles(
    ['first.csv', 'second.csv'].map((name) => ({
      name,
      mimeType: 'text/csv',
      buffer: Buffer.from('synthetic'),
    })),
  );
  await expect(page.getByText('Lendo e conferindo…', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Parar após este arquivo', exact: true }).click();
  release();
  await expect(page.getByText('Não enviado', { exact: true })).toBeVisible();
  expect(count).toBe(1);
  await expect(page.getByLabel('Conta de destino')).toBeEnabled();
});

test('leaving the upload screen stops subsequent submissions', async ({ page }) => {
  await signedIn(page);
  let requests = 0;
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/v1/imports', async (route) => {
    if (route.request().method() !== 'POST') return route.fulfill({ json: [] });
    requests++;
    await pending;
    return route.fulfill({ json: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', status: 'draft' } });
  });
  await page.goto('/imports');
  await page.getByLabel('Conta de destino').selectOption(account.id);
  await page.locator('input[type=file]').setInputFiles(
    ['first.csv', 'second.csv'].map((name) => ({
      name,
      mimeType: 'text/csv',
      buffer: Buffer.from('synthetic'),
    })),
  );
  await expect(page.getByText('Lendo e conferindo…', { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Minhas contas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Minhas contas', exact: true })).toBeVisible();
  const response = page.waitForResponse(
    (response) => response.url().endsWith('/v1/imports') && response.request().method() === 'POST',
  );
  release();
  await (await response).finished();
  await page.waitForTimeout(200);
  expect(requests).toBe(1);
  await expect(page).toHaveURL(/\/accounts$/);
});

for (const outcome of ['normal', 'lost-response', 'refresh-failure', 'rejected'] as const)
  test(`Statement confirmation handles ${outcome} without duplicating movements`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width: 390, height: 1000 });
    const id = 'ffffffff-ffff-4fff-8fff-ffffffffffff';
    const batch = {
      id,
      accountId: account.id,
      fileName: 'settlement_v2-synthetic.csv',
      status: 'draft',
      version: 1,
      reportType: 'account_statement',
      canIntegrate: true,
      sourceFormat: 'csv',
      openingBalance: null,
      closingBalance: null,
      openingMismatch: false,
      openingDateMismatch: false,
      items: [
        {
          ...transaction,
          id: '99999999-9999-4999-8999-999999999999',
          sourceRow: 2,
          selected: true,
          transactionType: 'income',
          action: 'reconcile',
          actionReason: 'Vincular ao lançamento existente.',
          linkedTransactionId: transaction.id,
          confirmNew: false,
          candidateDescriptions: [],
          duplicateLocked: false,
          duplicateCandidate: false,
          balanceAfter: null,
          metadata: {
            eventType: 'SETTLEMENT',
            isReleased: true,
            transactionTimestamp: '2026-10-01T12:00:00-03:00',
            settlementTimestamp: '2026-10-02T12:00:00-03:00',
            grossAmount: 10000,
            netAmount: 9500,
            realAmount: null,
            fees: -500,
            taxes: null,
            paymentMethod: 'visa',
            paymentMethodType: 'credit_card',
            brand: 'Visa',
            installments: 3,
            installmentNumber: 1,
            lastFourDigits: '0042',
          },
        },
      ],
    };
    let confirmations = 0;
    await page.route(`**/v1/imports/${id}**`, async (route) => {
      if (new URL(route.request().url()).pathname.endsWith('/matches'))
        return route.fulfill({
          json: [
            {
              itemId: batch.items[0].id,
              batchId: id,
              fileName: batch.fileName,
              status: 'matched',
              transactionId: transaction.id,
              reason: 'Referência, data e valor correspondem.',
              metadata: batch.items[0].metadata,
            },
          ],
        });
      if (route.request().method() === 'POST') {
        expect(new URL(route.request().url()).pathname).toBe(`/v1/imports/${id}/confirmations`);
        expect(route.request().headers()['idempotency-key']).toBeTruthy();
        confirmations++;
        if (outcome === 'rejected')
          return route.fulfill({
            status: 500,
            json: { title: 'Falha sintética antes de confirmar.' },
          });
        batch.status = 'confirmed';
        batch.version++;
        if (outcome === 'lost-response') return route.abort('failed');
      } else if (batch.status === 'confirmed' && outcome === 'refresh-failure') {
        return route.fulfill({ status: 500, json: { title: 'Falha sintética ao atualizar.' } });
      }
      return route.fulfill({ json: batch });
    });
    await page.goto(`/imports/${id}`);
    await expect(page.getByText('1 selecionado · 0 a classificar', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Classificar entradas e saídas' })).toHaveCount(
      0,
    );
    await expect(page.getByLabel('Tipo do movimento 2')).toBeEnabled();
    await page.getByText('Detalhes da liquidação', { exact: true }).click();
    await expect(page.getByText('0042', { exact: true })).toBeVisible();
    await expect(page.getByText('Visa', { exact: true })).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Confirmar 1 movimento' }).click();
    if (outcome === 'rejected') {
      await expect(page.getByRole('alert')).toContainText('Falha sintética antes de confirmar.');
      await expect(page.getByRole('button', { name: 'Confirmar 1 movimento' })).toBeEnabled();
      await expect(
        page.getByText('Revisão concluída. Somente movimentos novos foram adicionados.'),
      ).toHaveCount(0);
      expect(confirmations).toBe(1);
      return;
    }
    await expect(
      page.getByText('Revisão concluída. Somente movimentos novos foram adicionados.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Revisar para integrar às contas' })).toHaveCount(
      0,
    );
    expect(confirmations).toBe(1);
    await expect(page.getByRole('button', { name: 'Confirmar 1 movimento' })).toHaveCount(0);
    if (outcome === 'refresh-failure') {
      await expect(page.getByRole('button', { name: 'Atualizar relatório' })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Desfazer importação' })).toBeDisabled();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.route(`**/v1/transactions/${transaction.id}`, (route) =>
      route.fulfill({
        json: {
          ...transaction,
          reconciliationStatus: 'reconciled',
          sourceOperationId: 'mp-external-123',
        },
      }),
    );
    await page.route(`**/v1/imports/transaction-sources/${transaction.id}`, (route) =>
      route.fulfill({
        json: [
          {
            itemId: batch.items[0].id,
            batchId: id,
            fileName: batch.fileName,
            status: 'matched',
            transactionId: transaction.id,
            reason: 'Correspondente',
            metadata: batch.items[0].metadata,
          },
        ],
      }),
    );
    await page.goto(`/transactions?transaction=${transaction.id}`);
    await expect(page.getByRole('dialog', { name: 'Detalhes do movimento' })).toBeVisible();
    await expect(page.getByText('Detalhes do Mercado Pago', { exact: true })).toBeVisible();
    await expect(page.getByText('Conferida por arquivo', { exact: true })).toBeVisible();
    await expect(page.getByText('ID externo: mp-external-123', { exact: true })).toBeVisible();
    await page.getByText('Detalhes da liquidação', { exact: true }).click();
    await expect(page.getByText('0042', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver relatório de origem' })).toHaveAttribute(
      'href',
      `/imports/${id}`,
    );
  });

for (const width of [390, 1440])
  test(`category groups create, organize and select nested categories at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    const groups: { id: string; name: string; type: string; color: string }[] = [];
    const categories: {
      id: string;
      name: string;
      type: string;
      color: string;
      groupId: string | null;
      groupName: string | null;
    }[] = [];
    await page.route('**/v1/category-groups', async (route) => {
      if (route.request().method() === 'POST') {
        groups.push({
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          ...route.request().postDataJSON(),
        });
        return route.fulfill({ status: 201, json: groups[0] });
      }
      return route.fulfill({ json: groups });
    });
    await page.route('**/v1/categories', async (route) => {
      if (route.request().method() === 'POST') {
        const input = route.request().postDataJSON();
        categories.push({
          ...input,
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          groupName: groups.find((g) => g.id === input.groupId)?.name ?? null,
        });
        return route.fulfill({ status: 201, json: categories[0] });
      }
      return route.fulfill({ json: categories });
    });
    await page.goto('/categories');
    await page.getByRole('button', { name: 'Novo grupo', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Casa');
    await page.getByRole('button', { name: 'Criar grupo', exact: true }).click();
    await expect(
      page.getByRole('tabpanel').getByRole('heading', { name: 'Casa', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar categoria', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Luz');
    await expect(
      page.getByRole('dialog').getByRole('combobox', { name: 'Grupo', exact: true }),
    ).toHaveValue(groups[0].id);
    await page.getByRole('button', { name: 'Criar categoria', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('Luz', { exact: true })).toBeVisible();
    for (const theme of ['claro', 'escuro']) {
      await page
        .getByRole('button', { name: `Tema ${theme}`, exact: true })
        .first()
        .click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `/tmp/mywallet-categories-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto('/transactions?new=1');
    await expect(
      page
        .getByRole('dialog')
        .getByRole('combobox', { name: 'Categoria', exact: true })
        .locator('optgroup[label="Casa"] option'),
    ).toHaveText('Luz');
    await page
      .getByRole('dialog')
      .getByRole('combobox', { name: 'Categoria', exact: true })
      .selectOption(categories[0].id);
    await expect(
      page.getByRole('dialog').getByRole('combobox', { name: 'Categoria', exact: true }),
    ).toHaveValue(categories[0].id);
  });

test('import review separates locked duplicates and supports grouped categories on mobile', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const categoryId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const batch = {
    id,
    accountId: account.id,
    fileName: 'review.csv',
    sourceFormat: 'csv',
    status: 'draft',
    version: 1,
    canIntegrate: true,
    reportType: 'account_statement',
    openingBalance: 10000,
    closingBalance: 8000,
    accountOpeningDate: '2026-01-01',
    statementStartDate: '2026-10-01',
    openingMismatch: false,
    openingDateMismatch: false,
    recordedOpeningBalance: 10000,
    items: [
      {
        ...transaction,
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        description: 'Already recorded',
        sourceRow: 1,
        selected: false,
        duplicateCandidate: true,
        duplicateLocked: true,
        duplicateReason: 'recorded',
        sourceOperationId: 'ref-1',
      },
      {
        ...transaction,
        description: 'New bill',
        sourceRow: 2,
        selected: true,
        duplicateCandidate: false,
        duplicateLocked: false,
        duplicateReason: null,
        sourceOperationId: 'ref-2',
      },
    ],
  };
  await page.route('**/v1/categories', (route) =>
    route.fulfill({
      json: [
        {
          id: categoryId,
          name: 'Luz',
          type: 'expense',
          color: '#5ee9b5',
          groupId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
          groupName: 'Casa',
        },
      ],
    }),
  );
  await page.route(`**/v1/imports/${id}**`, async (route) => {
    if (route.request().method() === 'PATCH') {
      const patch = route.request().postDataJSON();
      expect(patch.categoryId).toBe(categoryId);
      expect(route.request().url()).toContain(transaction.id);
      batch.items[1].categoryId = patch.categoryId;
      batch.version++;
    }
    return route.fulfill({ json: batch });
  });
  await page.goto(`/imports/${id}`);
  await expect(page.getByLabel('Selecionar movimento 1')).toBeDisabled();
  await expect(page.getByText('1 duplicata excluída automaticamente')).toBeVisible();
  await page.getByRole('button', { name: /Duplicatas/ }).click();
  await expect(page.getByText('New bill', { exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Selecionar movimento 1')).toBeDisabled();
  await page.getByRole('button', { name: /Prontos/ }).click();
  await expect(page.getByText('Already recorded', { exact: true })).toHaveCount(0);
  await page.getByLabel('Categoria do movimento 2').selectOption(categoryId);
  await expect(page.getByLabel('Categoria do movimento 2')).toHaveValue(categoryId);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mywallet-review-390.png', fullPage: true });
});

test('mobile more menu exposes imports and category organization', async ({ page }) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Mais', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('link', { name: 'Grupos e categorias', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: 'Categorias', exact: true })).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

for (const width of [390, 1440])
  test(`group deletion previews category migration and protects defaults at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    const defaultId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      customId = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
    let deleted = false;
    const groups = [
      { id: customId, name: 'Casa', type: 'expense', color: '#5ee9b5', isDefault: false },
      { id: defaultId, name: 'Geral', type: 'expense', color: '#8296a0', isDefault: true },
    ];
    const categories = [
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Luz',
        type: 'expense',
        color: '#5ee9b5',
        groupId: customId,
        groupName: 'Casa',
      },
    ];
    await page.route('**/v1/category-groups', (route) => route.fulfill({ json: groups }));
    await page.route('**/v1/categories', (route) => route.fulfill({ json: categories }));
    await page.route(`**/v1/category-groups/${customId}/deletion-preview`, (route) =>
      route.fulfill({
        json: {
          id: customId,
          name: 'Casa',
          categoryCount: 1,
          destinationGroupId: defaultId,
          destinationGroupName: 'Geral',
          conflictingNames: [],
        },
      }),
    );
    await page.route(`**/v1/category-groups/${customId}`, (route) => {
      expect(route.request().method()).toBe('DELETE');
      deleted = true;
      groups.splice(0, 1);
      categories[0].groupId = defaultId;
      categories[0].groupName = 'Geral';
      return route.fulfill({ json: { deleted: true, movedCategories: 1 } });
    });
    await page.goto('/categories');
    await expect(page.getByRole('tabpanel').getByText('Padrão', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Excluir grupo Geral', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('tab', { name: /Casa/ }).click();
    await page.getByRole('button', { name: 'Excluir grupo Casa', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByText('1 categoria será movida', { exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(deleted).toBe(false);
    await page.getByRole('button', { name: 'Excluir grupo Casa', exact: true }).click();
    await page
      .getByRole('dialog')
      .getByRole('button', { name: 'Excluir grupo', exact: true })
      .click();
    await expect(page.getByRole('tab', { name: /Casa/ })).toHaveCount(0);
    await expect(
      page.getByRole('tabpanel').getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toBeVisible();
    expect(deleted).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/mywallet-default-group-${width}.png`, fullPage: true });
  });

test('a later statement points to unfinished history without proposing a new account opening', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  const currentId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    priorId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const current = {
    id: currentId,
    accountId: account.id,
    fileName: 'october.pdf',
    sourceFormat: 'pdf',
    status: 'draft',
    version: 1,
    canIntegrate: true,
    reportType: 'account_statement',
    accountOpeningDate: '2026-08-01',
    statementStartDate: '2026-10-01',
    openingDateMismatch: false,
    openingMismatch: true,
    canAdjustOpeningPosition: false,
    openingDifference: 1000,
    recordedOpeningBalance: 12000,
    openingBalance: 13000,
    closingBalance: 12000,
    previousImports: [
      {
        id: priorId,
        fileName: 'september.pdf',
        status: 'draft',
        firstDate: '2026-09-01',
        lastDate: '2026-09-30',
      },
    ],
    items: [
      {
        ...transaction,
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        sourceRow: 1,
        selected: true,
        duplicateLocked: false,
        duplicateCandidate: false,
        transactionType: 'expense',
        amount: -1000,
      },
    ],
  };
  const prior = {
    ...current,
    id: priorId,
    fileName: 'september.pdf',
    statementStartDate: '2026-09-01',
    openingBalance: 12000,
    closingBalance: 13000,
    openingMismatch: false,
    openingDifference: 0,
    previousImports: [],
    items: [{ ...current.items[0], amount: 1000, transactionType: 'income' }],
  };
  await page.route(`**/v1/imports/${currentId}`, (route) => route.fulfill({ json: current }));
  await page.route(`**/v1/imports/${priorId}`, (route) => route.fulfill({ json: prior }));
  await page.goto(`/imports/${currentId}`);
  await page.getByText(/^Arquivo e conciliação/).click();
  await expect(
    page.getByText('Diferença no histórico · a importação pode continuar', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Revisar posição inicial', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Confirmar 1 movimento', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole('link', { name: 'Conferir movimentações da conta', exact: true }),
  ).toHaveAttribute('href', `/accounts/${account.id}`);
  await page.screenshot({ path: '/tmp/mywallet-reconciliation-gap-390.png', fullPage: true });
  await page.getByRole('link', { name: /september.pdf/ }).click();
  await expect(page).toHaveURL(`/imports/${priorId}`);
  await expect(page.getByLabel('Tipo do movimento 1')).toHaveValue('income');
  await expect(
    page.getByRole('button', { name: 'Classificar entradas e saídas', exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Confirmar 1 movimento', exact: true }),
  ).toBeEnabled();
});

test('reprocessing preserves the current draft on source errors and supports saved data and original-file rereading', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 1000 });
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const batch = {
    id,
    accountId: account.id,
    fileName: 'original.csv',
    sourceFormat: 'csv',
    status: 'draft',
    version: 1,
    canIntegrate: true,
    canReprocess: true,
    reportType: 'account_statement',
    accountOpeningDate: '2026-10-01',
    statementStartDate: '2026-10-01',
    openingDateMismatch: false,
    openingMismatch: false,
    canAdjustOpeningPosition: false,
    openingBalance: 10000,
    closingBalance: 9000,
    recordedOpeningBalance: 10000,
    previousImports: [],
    items: [
      {
        ...transaction,
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        description: 'Dinheiro reservado Cofrinho',
        sourceRow: 1,
        selected: true,
        duplicateLocked: false,
        duplicateCandidate: false,
        transactionType: 'expense',
        amount: -1000,
      },
    ],
  };
  let saved = 0,
    reread = 0,
    reads = 0;
  await page.route(`**/v1/imports/${id}`, (route) => {
    reads++;
    return route.fulfill({ json: batch });
  });
  await page.route(`**/v1/imports/${id}/reprocess`, (route) => {
    expect(route.request().postDataJSON()).toEqual({ version: 1, resetClassification: true });
    expect(route.request().headers()['x-workspace-id']).toBe(workspace.id);
    batch.version++;
    batch.items[0].transactionType = 'transfer';
    saved++;
    return route.fulfill({ json: batch });
  });
  await page.route(`**/v1/imports/${id}/reprocess-file`, (route) => {
    expect(route.request().headers()['content-type']).toContain('multipart/form-data');
    const data = route.request().postData()!;
    if (data.includes('wrong.csv'))
      return route.fulfill({
        status: 422,
        json: { title: 'Selecione o mesmo arquivo original desta importação.' },
      });
    expect(data).toContain('original.csv');
    expect(data).toContain('name="version"\r\n\r\n2');
    expect(data).toContain('name="resetClassification"\r\n\r\nfalse');
    batch.version++;
    reread++;
    return route.fulfill({ json: batch });
  });
  await page.goto(`/imports/${id}`);
  await page.getByRole('button', { name: 'Reprocessar importação', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('checkbox', { name: 'Refazer também os tipos financeiros' }),
  ).not.toBeChecked();
  await page
    .getByRole('dialog')
    .getByRole('checkbox', { name: 'Refazer também os tipos financeiros' })
    .check();
  await page.getByRole('button', { name: 'Reprocessar dados salvos', exact: true }).click();
  await expect(
    page.getByText('Importação reprocessada. Confira o resultado antes de confirmar.', {
      exact: true,
    }),
  ).toBeVisible();
  expect(saved).toBe(1);
  await expect(page.getByLabel('Tipo do movimento 1')).toHaveValue('transfer');
  await page.getByRole('button', { name: 'Reprocessar importação', exact: true }).click();
  const beforeError = reads;
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({ name: 'wrong.csv', mimeType: 'text/csv', buffer: Buffer.from('synthetic') });
  await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
    'Selecione o mesmo arquivo original desta importação.',
  );
  expect(batch.version).toBe(2);
  expect(reads).toBe(beforeError);
  await page.screenshot({ path: '/tmp/mywallet-reprocess-390.png', fullPage: true });
  await page
    .getByRole('dialog')
    .locator('input[type=file]')
    .setInputFiles({
      name: 'original.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from('synthetic'),
    });
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(reread).toBe(1);
  expect(batch.version).toBe(3);
});

test('confirmed imports do not offer reprocessing that could rewrite financial history', async ({
  page,
}) => {
  await signedIn(page);
  const id = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  await page.route(`**/v1/imports/${id}`, (route) =>
    route.fulfill({
      json: {
        id,
        accountId: account.id,
        status: 'confirmed',
        version: 2,
        canIntegrate: true,
        canReprocess: false,
        sourceFormat: 'pdf',
        fileName: 'confirmed.pdf',
        openingBalance: 10000,
        closingBalance: 10000,
        recordedOpeningBalance: 10000,
        items: [],
      },
    }),
  );
  await page.goto(`/imports/${id}`);
  await expect(
    page.getByRole('button', { name: 'Desfazer importação', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Reprocessar importação', exact: true }),
  ).toHaveCount(0);
});

for (const width of [390, 1440])
  test(`category tabs pin Geral first and restrict custom colors to groups at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    const groups = [
      {
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        name: 'Casa',
        type: 'expense',
        color: '#123456',
        isDefault: false,
      },
      {
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        name: 'Geral',
        type: 'expense',
        color: '#5ee9b5',
        isDefault: true,
      },
      {
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Geral',
        type: 'income',
        color: '#5ee9b5',
        isDefault: true,
      },
    ];
    const categories = [
      {
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        name: 'Luz',
        type: 'expense',
        color: '#5ee9b5',
        groupId: groups[0].id,
        groupName: 'Casa',
      },
    ];
    let saved: Record<string, unknown> | undefined;
    await page.route('**/v1/category-groups', (route) => route.fulfill({ json: groups }));
    await page.route('**/v1/categories', (route) => {
      if (route.request().method() === 'POST') {
        saved = route.request().postDataJSON();
        return route.fulfill({ json: { id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', ...saved } });
      }
      return route.fulfill({ json: categories });
    });
    await page.goto('/categories');
    await expect(page.getByRole('tab').first()).toContainText('Geral');
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('.category-group-panel .category-row')).toHaveCount(0);
    await page.getByRole('tab', { name: /Casa/ }).click();
    await expect(
      page.getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toBeVisible();
    for (const theme of ['claro', 'escuro']) {
      await page
        .getByRole('button', { name: `Tema ${theme}`, exact: true })
        .first()
        .click();
      const dot = page
        .locator('.category-row')
        .filter({ has: page.getByRole('button', { name: 'Editar categoria Luz', exact: true }) })
        .locator('.category-type-dot');
      expect(await dot.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
        theme === 'claro' ? 'rgb(195, 72, 84)' : 'rgb(242, 138, 151)',
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `/tmp/mywallet-category-tabs-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    await page.getByRole('button', { name: 'Editar categoria Luz', exact: true }).click();
    await expect(page.getByRole('dialog').locator('input[type=color]')).toHaveCount(0);
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Editar grupo Casa', exact: true }).click();
    await expect(page.getByRole('dialog').locator('input[type=color]')).toHaveValue('#123456');
    await page.getByRole('button', { name: 'Restaurar cor padrão', exact: true }).click();
    await expect(page.getByRole('dialog').locator('input[type=color]')).toHaveValue('#f28a97');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('tab').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Casa/ })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('textbox', { name: 'Buscar grupos e categorias' }).fill('Luz');
    await expect(
      page.getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toBeVisible();
    await page.getByRole('textbox', { name: 'Buscar grupos e categorias' }).fill('');
    await expect(
      page.getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('tab', { name: /Casa/ }).click();
    await page.getByRole('button', { name: 'Adicionar categoria', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Água');
    await page.getByRole('button', { name: 'Criar categoria', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(saved).toMatchObject({ type: 'expense', color: '#f28a97', groupId: groups[0].id });
    await page.getByRole('button', { name: 'Receitas', exact: true }).click();
    await expect(page.getByRole('tab').first()).toContainText('Geral');
    await page.getByRole('button', { name: 'Adicionar categoria', exact: true }).click();
    await page.getByRole('dialog').getByLabel('Nome', { exact: true }).fill('Salário');
    await page.getByRole('button', { name: 'Criar categoria', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(saved).toMatchObject({ type: 'income', color: '#5ee9b5', groupId: groups[2].id });
  });

test('category deletion asks for confirmation and removes the option without deleting financial history', async ({
  page,
}) => {
  await signedIn(page);
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    groupId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const categories = [
    { id, name: 'Luz', type: 'expense', color: '#5ee9b5', groupId, groupName: 'Geral' },
  ];
  let deleted = false;
  await page.route('**/v1/category-groups', (route) =>
    route.fulfill({
      json: [{ id: groupId, name: 'Geral', type: 'expense', color: '#5ee9b5', isDefault: true }],
    }),
  );
  await page.route('**/v1/categories', (route) => route.fulfill({ json: categories }));
  await page.route(`**/v1/categories/${id}`, (route) => {
    expect(route.request().method()).toBe('DELETE');
    deleted = true;
    categories.splice(0);
    return route.fulfill({ json: { id, archived: true } });
  });
  await page.goto('/categories');
  await page.getByRole('button', { name: 'Excluir categoria Luz', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByText(/Movimentações e planejamentos anteriores/),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Cancelar', exact: true }).click();
  expect(deleted).toBe(false);
  await page.getByRole('button', { name: 'Excluir categoria Luz', exact: true }).click();
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Excluir categoria', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Editar categoria Luz', exact: true })).toHaveCount(
    0,
  );
  expect(deleted).toBe(true);
});

for (const width of [390, 1440])
  test(`planning includes Outros in actual totals and compares planned versus actual at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    const plan = monthlyPlan('2026-10');
    const others = {
      categoryId: null,
      groupId: null,
      groupName: 'Outros',
      name: 'Outros',
      type: 'expense',
      color: '#f28a97',
      planned: null,
      actual: 5000,
      difference: null,
      transactionCount: 197,
      archived: false,
    };
    const payload = {
      ...plan,
      lines: [...plan.lines, others],
      totals: {
        ...plan.totals,
        actualExpense: 60000,
        actualResult: 220000,
        missingCategoryCount: 197,
        expenseDifference: -10000,
        resultDifference: -30000,
      },
    };
    await page.route('**/v1/planning/**', (route) => route.fulfill({ json: payload }));
    await page.goto('/planning');
    await expect(
      page.getByText('Sem categoria também entra na conta', { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText('Seu realizado ainda precisa de revisão', { exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText(/197 lançamentos estão em Outros e já fazem parte do realizado/),
    ).toBeVisible();
    const expenses = page.getByRole('article', { name: 'Orçamento de despesas', exact: true });
    await expect(expenses.getByText('R$ 500,00', { exact: true })).toBeVisible();
    await expect(expenses.getByText('R$ 600,00', { exact: true })).toBeVisible();
    await expect(expenses.getByText('R$ 100,00 acima do orçamento', { exact: true })).toBeVisible();
    const incomeCard = page.getByRole('article', { name: 'Receitas do mês', exact: true });
    await expect(incomeCard.getByText('R$ 3.000,00', { exact: true })).toBeVisible();
    await expect(incomeCard.getByText('R$ 2.800,00', { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('article', { name: 'Aporte planejado', exact: true })
        .getByText('Não identificado', { exact: true }),
    ).toBeVisible();
    const line = page
      .locator('.budget-line')
      .filter({ has: page.getByText('Outros', { exact: true }) });
    await expect(line.getByText('R$ 50,00', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/mywallet-planning-comparison-${width}.png`,
      fullPage: true,
    });
  });

for (const width of [390, 1440])
  test(`Alelo benefit separation, upload and manual balance adjustment at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1100 });
    const benefit = {
      ...account,
      id: '88888888-8888-4888-8888-888888888888',
      name: 'Alelo Alimentação',
      institution: 'alelo',
      type: 'benefit_food',
      openingBalance: 0,
      openingDate: '2026-01-01',
      balance: 12000,
    };
    const reserve = {
      ...account,
      id: '99999999-9999-4999-8999-999999999999',
      name: 'Reserva',
      type: 'reserve',
      balance: 20000,
    };
    await page.route('**/v1/accounts', (route) =>
      route.fulfill({ json: [account, benefit, reserve] }),
    );
    await page.route('**/v1/dashboard*', (route) =>
      route.fulfill({
        json: {
          balance: account.balance,
          benefitBalance: 12000,
          reserveBalance: 20000,
          recordedResources: account.balance + 32000,
          income: 100000,
          expense: 50000,
          unclassified: 0,
          accounts: [account, benefit, reserve],
          coverage: 'tracked-accounts',
        },
      }),
    );
    await page.goto('/');
    await expect(page.getByText('DINHEIRO DISPONÍVEL', { exact: false })).toBeVisible();
    await expect(page.getByText('Benefícios · uso restrito', { exact: true })).toBeVisible();
    await page.goto('/accounts');
    await page.getByRole('button', { name: 'Benefícios', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Alelo Alimentação', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: account.name, exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Corrigir saldo', exact: true }).click();
    await page.getByLabel('Saldo atual correto (R$)').fill('192,20');
    await page.getByLabel('Motivo da correção').fill('Saldo conferido no Meu Alelo');
    await expect(page.getByText('Diferença a registrar: R$ 72,20')).toBeVisible();
    let posted = 0;
    await page.route(`**/v1/accounts/${benefit.id}/balance-adjustments`, async (route) => {
      posted++;
      expect(route.request().postDataJSON()).toEqual({
        targetBalance: 19220,
        expectedBalance: 12000,
        reason: 'Saldo conferido no Meu Alelo',
      });
      expect(route.request().headers()['idempotency-key']).toBeTruthy();
      return route.fulfill({ json: { id: transaction.id } });
    });
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Registrar correção de saldo', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Corrigir saldo atual' })).toHaveCount(0);
    expect(posted).toBe(1);
    await page.goto('/imports');
    await page.getByLabel('Conta de destino').selectOption(benefit.id);
    const batchId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const batch = {
      id: batchId,
      accountId: benefit.id,
      institution: 'alelo',
      reportType: 'benefit_statement',
      reconciliationCapability: 'partial',
      status: 'draft',
      version: 1,
      canIntegrate: true,
      canReprocess: true,
      sourceFormat: 'pdf',
      fileName: 'alelo.pdf',
      openingBalance: null,
      closingBalance: null,
      openingMismatch: false,
      openingDateMismatch: false,
      items: [
        {
          ...transaction,
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          sourceRow: 1,
          sourceOperationId: null,
          transactionType: 'expense',
          description: 'Synthetic benefit purchase',
          amount: -1000,
          selected: true,
          action: 'create',
          actionReason: 'Novo movimento identificado na fonte.',
          linkedTransactionId: null,
          confirmNew: false,
          candidateDescriptions: [],
          duplicateLocked: false,
          duplicateCandidate: false,
          metadata: null,
          categoryId: null,
        },
      ],
    };
    await page.route('**/v1/imports', async (route) => {
      if (route.request().method() === 'POST') {
        expect(route.request().postDataBuffer()?.toString()).toContain(benefit.id);
        return route.fulfill({ json: batch });
      }
      return route.fulfill({ json: [] });
    });
    await page.route(`**/v1/imports/${batchId}`, (route) => route.fulfill({ json: batch }));
    await page.locator('input[type=file]').setInputFiles({
      name: 'alelo.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-synthetic'),
    });
    await expect(
      page.getByText('Alelo Alimentação · histórico parcial', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Synthetic benefit purchase', { exact: true })).toBeVisible();
    await expect(page.getByText('Novo · pendente de conciliação', { exact: true })).toBeVisible();
    await page.screenshot({ path: `/tmp/mywallet-alelo-review-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('first statement initializes opening automatically and refund review links original spending', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 1100 });
  const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaab';
  const item = {
    ...transaction,
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    sourceRow: 1,
    sourceOperationId: 'mp-refund',
    metadata: null,
    selected: true,
    action: 'create',
    actionReason: 'Novo movimento',
    duplicateLocked: false,
    duplicateCandidate: false,
    categoryId: null,
    linkedTransactionId: null,
    confirmNew: false,
    refundOfId: null,
    refundCandidates: [],
    candidateDescriptions: [],
  };
  const opening = {
    id,
    accountId: account.id,
    fileName: 'first.csv',
    status: 'draft',
    version: 1,
    canIntegrate: true,
    reportType: 'account_statement',
    sourceFormat: 'csv',
    willInitializeOpening: true,
    openingMismatch: true,
    openingDateMismatch: true,
    openingBalance: 10000,
    closingBalance: 9000,
    recordedOpeningBalance: 0,
    statementStartDate: '2026-01-01',
    items: [{ ...item, amount: -1000 }],
  };
  await page.route(`**/v1/imports/${id}`, (route) => route.fulfill({ json: opening }));
  await page.goto(`/imports/${id}`);
  await expect(
    page.getByText('Saldo anterior ao período identificado no extrato', { exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Confirmar 1 movimento', exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByText('A posição inicial da conta precisa de revisão.', { exact: true }),
  ).toHaveCount(0);
  const metadata = {
    eventType: 'REFUND',
    transactionTimestamp: '2026-10-02T12:00:00-03:00',
    settlementTimestamp: '2026-10-05T12:00:00-03:00',
    grossAmount: 1000,
    netAmount: 300,
    realAmount: null,
    fees: 0,
    taxes: 0,
    paymentMethod: null,
    paymentMethodType: null,
    brand: null,
    installments: null,
    installmentNumber: null,
    lastFourDigits: null,
    isReleased: true,
  };
  const edi = {
    ...opening,
    reportType: 'account_statement',
    willInitializeOpening: false,
    openingMismatch: false,
    openingDateMismatch: false,
    openingBalance: null,
    closingBalance: null,
    items: [
      {
        ...item,
        amount: 300,
        transactionType: 'unclassified',
        selected: false,
        action: 'review',
        metadata,
        refundCandidates: [
          {
            id: transaction.id,
            description: 'Compra original · disponível para devolver: R$ 10,00',
          },
        ],
      },
    ],
  };
  await page.route(`**/v1/imports/${id}`, (route) => route.fulfill({ json: edi }));
  await page.route(`**/v1/imports/${id}/items/${item.id}`, (route) => {
    expect(route.request().postDataJSON().refundOfId).toBe(transaction.id);
    edi.version++;
    Object.assign(edi.items[0], {
      refundOfId: transaction.id,
      transactionType: 'expense',
      selected: true,
      action: 'create',
    });
    return route.fulfill({ json: edi });
  });
  await page.reload();
  await page.getByLabel('Origem da devolução 1').selectOption(transaction.id);
  await expect(
    page.getByText('Devolução vinculada · reduz a categoria original', { exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel('Tipo do movimento 1')).toHaveValue('expense');
  await expect(page.getByLabel('Tipo do movimento 1')).toBeDisabled();
  await expect(
    page.getByRole('button', { name: 'Confirmar 1 movimento', exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('account forms use automatic defaults and preserve existing baseline amounts on edits', async ({
  page,
}) => {
  await signedIn(page);
  const writes: Record<string, unknown>[] = [];
  await page.route('**/v1/accounts', async (route) => {
    if (route.request().method() === 'POST') {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: { ...account, ...writes.at(-1) } });
    }
    return route.fulfill({ json: [account] });
  });
  await page.route(`**/v1/accounts/${account.id}`, async (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { ...account, ...writes.at(-1) } });
  });
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Saldo inicial (R$)')).toHaveCount(0);
  await expect(dialog.getByLabel('Data inicial')).toHaveCount(0);
  await dialog.getByLabel('Nome da conta').fill('Imported wallet');
  await dialog.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toEqual({
    name: 'Imported wallet',
    institution: 'mercado_pago',
    type: 'checking',
  });
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await dialog.getByLabel('Nome da conta').fill('Renamed account');
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toEqual({
    name: 'Renamed account',
    institution: 'mercado_pago',
    type: 'checking',
  });
});

const automationCategory = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
  name: 'Mercado',
  type: 'expense',
  color: '#ff8899',
};
const automationAgent = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
  name: 'Supermercado Exemplo',
  enabled: true,
  version: 1,
  identifiers: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      counterpartyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      accountId: account.id,
      sourceKind: 'settlement',
      identifierKind: 'store_id',
      value: 'STORE-TEST',
      enabled: true,
    },
  ],
  rules: [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
      counterpartyId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
      accountId: account.id,
      transactionType: 'expense',
      categoryId: automationCategory.id,
      enabled: true,
      version: 1,
    },
  ],
};

test('a transaction can explicitly remember an agent category without imposing a registration-date cutoff', async ({
  page,
}) => {
  await signedIn(page);
  let saved: Record<string, unknown> | undefined;
  await page.route('**/v1/counterparties', (r) => r.fulfill({ json: [] }));
  await page.route('**/v1/categories', (r) => r.fulfill({ json: [automationCategory] }));
  await page.route('**/v1/transactions', async (r) => {
    if (r.request().method() === 'POST') {
      saved = r.request().postDataJSON();
      return r.fulfill({ json: { ...transaction, ...saved } });
    }
    return r.fulfill({ json: { items: [transaction], nextCursor: null } });
  });
  await page.goto('/transactions?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Valor (R$)').fill('12,50');
  await dialog.getByLabel('Descrição', { exact: true }).fill('Supermercado Exemplo');
  await dialog.getByLabel('Data', { exact: true }).fill('2025-01-01');
  await expect(dialog.getByLabel('Data', { exact: true })).not.toHaveAttribute('min', /.+/);
  await dialog
    .getByRole('combobox', { name: 'Categoria', exact: true })
    .selectOption(automationCategory.id);
  await dialog
    .locator('summary')
    .filter({ hasText: /^Pessoa ou estabelecimento/ })
    .click();
  await dialog
    .getByRole('combobox', { name: 'Pessoa ou estabelecimento', exact: true })
    .selectOption('new');
  await dialog.getByLabel('Nome da pessoa ou estabelecimento').fill('Supermercado Exemplo');
  await dialog.getByLabel(/Usar esta categoria para esta pessoa/).check();
  await dialog.getByRole('button', { name: 'Registrar movimento', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved).toMatchObject({
    counterpartyName: 'Supermercado Exemplo',
    rememberCategory: true,
    categoryId: automationCategory.id,
    transactionDate: '2025-01-01',
    amount: -1250,
  });
});
for (const width of [390, 1440])
  test(`agent table applies a statement description relation to history at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1100 });
    let related = false;
    await page.route('**/v1/counterparties', (r) => r.fulfill({ json: [automationAgent] }));
    await page.route('**/v1/categories', (r) => r.fulfill({ json: [automationCategory] }));
    await page.route(`**/v1/counterparties/${automationAgent.id}/relations`, async (r) => {
      expect(r.request().postDataJSON()).toMatchObject({
        identifierKind: 'description',
        sourceKind: 'account_statement',
        value: 'Pix enviado Mercado Exemplo',
        accountId: account.id,
        categoryId: automationCategory.id,
      });
      related = true;
      return r.fulfill({ json: { id: automationAgent.rules[0].id, updated: 7 } });
    });
    await page.goto('/counterparties');
    await expect(
      page.getByRole('heading', { name: 'Pessoas e estabelecimentos', exact: true }),
    ).toBeVisible();
    await page.getByText(automationAgent.name, { exact: true }).click();
    await page.getByText('Relacionar uma origem e aplicar ao histórico', { exact: true }).click();
    await page
      .getByRole('combobox', { name: 'Conta da relação', exact: true })
      .selectOption(account.id);
    await expect(
      page
        .getByRole('combobox', { name: 'Origem da identificação', exact: true })
        .locator('option[value=settlement]'),
    ).toHaveCount(0);
    await page
      .getByLabel('Descrição como aparece no extrato', { exact: true })
      .fill('Pix enviado Mercado Exemplo');
    await page
      .getByRole('combobox', { name: 'Categoria da relação', exact: true })
      .selectOption(automationCategory.id);
    await page
      .getByRole('button', { name: 'Relacionar e aplicar ao histórico', exact: true })
      .click();
    await expect(
      page.getByRole('status').filter({ hasText: '7 lançamentos atualizados' }),
    ).toBeVisible();
    expect(related).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/mywallet-counterparty-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('import review saves learning intent for confirmation and shows the automatic category explanation', async ({
  page,
}) => {
  await signedIn(page);
  const id = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const batch = {
    id,
    accountId: account.id,
    fileName: 'agent-statement.pdf',
    sourceFormat: 'pdf',
    reportType: 'account_statement',
    status: 'draft',
    version: 1,
    canIntegrate: true,
    openingMismatch: false,
    openingDateMismatch: false,
    openingBalance: 10000,
    closingBalance: 9000,
    items: [
      {
        ...transaction,
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        sourceRow: 1,
        selected: true,
        duplicateCandidate: false,
        duplicateLocked: false,
        action: 'create',
        sourceOperationId: 'synthetic-agent-operation',
        balanceAfter: 9000,
        categoryId: automationCategory.id,
        classificationRuleId: automationAgent.rules[0].id as string | null,
        counterpartyId: automationAgent.id as string | null,
        counterpartyName: null as string | null,
        rememberCategory: false,
      },
    ],
  };
  let learned = false;
  await page.route('**/v1/counterparties', (r) => r.fulfill({ json: [automationAgent] }));
  await page.route('**/v1/categories', (r) => r.fulfill({ json: [automationCategory] }));
  await page.route(`**/v1/imports/${id}`, (r) => r.fulfill({ json: batch }));
  await page.route(`**/v1/imports/${id}/items/${batch.items[0].id}`, async (r) => {
    const body = r.request().postDataJSON();
    expect(body).toMatchObject({
      counterpartyId: automationAgent.id,
      rememberCategory: true,
      categoryId: automationCategory.id,
    });
    learned = true;
    Object.assign(batch.items[0], body);
    batch.version++;
    return r.fulfill({ json: batch });
  });
  await page.goto(`/imports/${id}`);
  await expect(page.getByText('Categoria automática · regra salva', { exact: true })).toBeVisible();
  await page
    .getByRole('combobox', { name: 'Pessoa ou estabelecimento', exact: true })
    .selectOption(automationAgent.id);
  await page.getByLabel(/Usar esta categoria para esta pessoa/).check();
  await page
    .getByRole('button', { name: 'Salvar relação para a confirmação', exact: true })
    .click();
  await expect(page.getByRole('button', { name: 'Atualizar relação', exact: true })).toBeVisible();
  expect(learned).toBe(true);
  await expect(
    page.getByRole('button', { name: 'Confirmar 1 movimento', exact: true }),
  ).toBeEnabled();
  await expect(page.getByText('Categoria automática · regra salva', { exact: true })).toBeVisible();
});

test('retained EDI is read-only and cannot post or reprocess new movements', async ({ page }) => {
  await signedIn(page);
  const id = 'ffffffff-ffff-4fff-8fff-fffffffffff1';
  await page.route(`**/v1/imports/${id}`, (route) =>
    route.fulfill({
      json: {
        id,
        accountId: account.id,
        fileName: 'legacy-edi.csv',
        status: 'draft',
        version: 1,
        reportType: 'settlement',
        canIntegrate: false,
        canReprocess: false,
        openingBalance: null,
        closingBalance: null,
        sourceFormat: 'csv',
        items: [{ ...transaction, sourceRow: 1, selected: true, action: 'create', metadata: null }],
      },
    }),
  );
  let mutations = 0;
  await page.route(`**/v1/imports/${id}/**`, async (route) => {
    mutations++;
    await route.fulfill({ status: 500, json: {} });
  });
  await page.goto(`/imports/${id}`);
  await expect(
    page.getByText('Relatório EDI antigo · disponível para consulta', { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: /Confirmar|Reprocessar/ })).toHaveCount(0);
  await expect(page.getByLabel('Tipo do movimento 1')).toBeDisabled();
  expect(mutations).toBe(0);
});

for (const width of [390, 1440])
  test(`accepts a suggested identity without forcing a category at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1100 });
    const maria = { ...automationAgent, name: 'Maria Oliveira', identifiers: [], rules: [] };
    await page.route('**/v1/counterparties', (route) => route.fulfill({ json: [maria] }));
    await page.route('**/v1/counterparties/suggestions', (route) => {
      expect(route.request().method()).toBe('POST');
      const input = route.request().postDataJSON();
      return route.fulfill({
        json: input.value.includes('Maria')
          ? [{ counterpartyId: maria.id, name: maria.name, reason: 'abbreviation' }]
          : [],
      });
    });
    let saved: Record<string, unknown> | undefined;
    await page.route('**/v1/transactions', (route) => {
      if (route.request().method() === 'POST') {
        saved = route.request().postDataJSON();
        return route.fulfill({ json: { ...transaction, ...saved } });
      }
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });
    await page.goto('/transactions?new=1');
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Valor (R$)').fill('25,00');
    await dialog.getByLabel('Descrição', { exact: true }).fill('Pagamento cartão Maria Oliv');
    await expect(
      dialog.getByText('Possível pessoa ou estabelecimento', { exact: true }),
    ).toBeVisible();
    expect(saved).toBeUndefined();
    await dialog
      .getByRole('button', {
        name: 'Vincular Maria Oliveira e reconhecer esta descrição',
        exact: true,
      })
      .click();
    await expect(
      dialog.getByRole('combobox', { name: 'Pessoa ou estabelecimento', exact: true }),
    ).toHaveValue(maria.id);
    await expect(
      dialog.getByLabel(
        'Reconhecer esta descrição no histórico e nos próximos movimentos desta conta',
      ),
    ).toBeChecked();
    await expect(
      dialog.getByLabel(
        'Usar esta categoria para esta pessoa ou estabelecimento neste tipo de movimento',
      ),
    ).not.toBeChecked();
    await dialog.getByRole('button', { name: 'Registrar movimento', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    expect(saved).toMatchObject({
      counterpartyId: maria.id,
      rememberCounterparty: true,
      rememberCategory: false,
      categoryId: null,
      amount: -2500,
    });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('links an additional statement description from the person page without requiring a category', async ({
  page,
}) => {
  await signedIn(page);
  await page.route('**/v1/counterparties', (route) =>
    route.fulfill({ json: [{ ...automationAgent, name: 'Maria Oliveira' }] }),
  );
  let input: Record<string, unknown> | undefined;
  await page.route(`**/v1/counterparties/${automationAgent.id}/identifiers`, (route) => {
    input = route.request().postDataJSON();
    return route.fulfill({ json: { linked: 3, categorized: 0 } });
  });
  await page.goto('/counterparties');
  await page.getByText('Maria Oliveira', { exact: true }).click();
  await page.getByText('Adicionar descrição de reconhecimento', { exact: true }).click();
  await page
    .getByRole('combobox', { name: 'Conta da descrição', exact: true })
    .selectOption(account.id);
  await page
    .getByLabel('Nova descrição do extrato', { exact: true })
    .fill('Pagamento cartão Maria Oliveira');
  await page
    .getByRole('button', { name: 'Vincular descrição e aplicar ao histórico', exact: true })
    .click();
  await expect(page.getByRole('status')).toContainText(
    '3 lançamentos vinculados; 0 categorias atualizadas',
  );
  expect(input).toEqual({
    accountId: account.id,
    sourceKind: 'account_statement',
    value: 'Pagamento cartão Maria Oliveira',
  });
});
