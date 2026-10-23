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
    await page.getByRole('dialog').getByLabel('Nome da conta').fill('Nova conta');
    await page.getByRole('button', { name: 'Tema claro', exact: true }).isVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goto('/transactions');
    await expect(page.getByRole('button', { name: /Compra de supermercado/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/imports');
    await expect(page.getByRole('heading', { name: /Seu Mercado Pago/ })).toBeVisible();
    await page.getByLabel('Conta de destino').selectOption(account.id);
    await expect(page.getByRole('button', { name: 'Selecionar extrato' })).toBeEnabled();
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
  await expect(page.getByText('A posição inicial da conta precisa de revisão.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Confirmar 1 movimentos' })).toBeDisabled();
  page.once('dialog', (dialog) => dialog.accept());
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
  await page
    .locator('input[type=file]')
    .setInputFiles({
      name: 'synthetic.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(
        'INITIAL_BALANCE;CREDITS;DEBITS;FINAL_BALANCE\n100,00;0,00;-10,00;90,00\n\nRELEASE_DATE;TRANSACTION_TYPE;REFERENCE_ID;TRANSACTION_NET_AMOUNT;PARTIAL_BALANCE\n01-10-2026;Pagamento;123456;-10,00;90,00',
      ),
    });
  await expect(page.getByRole('heading', { name: 'Revise seu extrato' })).toBeVisible();
  await expect(page.getByText(/Formato: CSV/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Salvar apenas como histórico' })).toBeVisible();
});
