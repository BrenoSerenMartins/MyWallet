import { test, expect, type Page, type Locator } from '@playwright/test';
async function chooseSelect(control: Locator, value: string) {
  if ((await control.getAttribute('aria-expanded')) !== 'true') await control.click();
  const options = control.page().getByRole('listbox');
  await options.locator('[data-value=' + JSON.stringify(value) + ']').click();
  await expect(options).toBeHidden();
}
async function fillControl(control: Locator, value: string) {
  if ((await control.getAttribute('data-control')) === 'month') {
    await control.click();
    const popup = control
      .page()
      .getByRole('dialog', { name: /^Selecionar mês:/ })
      .last();
    if (value) {
      await popup.getByRole('textbox', { name: 'Ano', exact: true }).fill(value.slice(0, 4));
      await popup.locator('[data-month=' + JSON.stringify(value) + ']').click();
    } else await popup.getByRole('button', { name: 'Limpar', exact: true }).click();
    await expect(popup).toBeHidden();
  } else await control.fill(value);
}
async function expectControlValue(control: Locator, value: string) {
  if ((await control.getAttribute('data-value')) !== null)
    await expect(control).toHaveAttribute('data-value', value);
  else await expect(control).toHaveValue(value);
}
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
async function signedIn(page: Page, rememberSpace = true) {
  await page.addInitScript(
    ({ user, rememberSpace }) => {
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
      if (rememberSpace)
        localStorage.setItem(
          'mywallet-workspace:' + user.id,
          '44444444-4444-4444-8444-444444444444',
        );
      else localStorage.removeItem('mywallet-workspace:' + user.id);
    },
    { user, rememberSpace },
  );
  await page.route('https://*.supabase.co/**', (route) => route.fulfill({ json: { user } }));
  await page.route('**/v1/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    let data: unknown = [];
    if (path === '/v1/workspaces') data = [workspace];
    else if (path === '/v1/accounts') data = [account];
    else if (path.startsWith('/v1/planning/')) data = monthlyPlan(path.split('/').pop()!, 0);
    else if (path === '/v1/commitments')
      data = commitmentsFixture(
        new URL(route.request().url()).searchParams.get('month') ?? '2026-11',
      );
    else if (path === '/v1/cards') data = { today: '2026-11-01', cards: [] };
    else if (path === '/v1/wealth' || path === '/v1/wealth/overview') data = wealthFixture(false);
    else if (path === '/v1/categories') data = [];
    else if (path === '/v1/transactions') data = { items: [transaction], nextCursor: null };
    else if (path === '/v1/dashboard/history')
      data = historyFixture(
        new URL(route.request().url()).searchParams.get('month')!,
        Number(new URL(route.request().url()).searchParams.get('months')),
      );
    else if (path === '/v1/dashboard')
      data = {
        balance: 345678,
        income: 1000000,
        expense: 654322,
        unclassified: 0,
        expenseGroups: [{ groupId: null, name: 'Outros', amount: 654322, count: 1 }],
        accounts: [account],
        coverage: 'tracked-accounts',
      };
    return route.fulfill({ json: data });
  });
}
function historyFixture(month: string, count: number) {
  const [year, number] = month.split('-').map(Number);
  return {
    months: count,
    from: '',
    to: '',
    items: Array.from({ length: count }, (_, index) => ({
      month: new Date(Date.UTC(year, number - count + index, 1)).toISOString().slice(0, 7),
      income: index === 0 ? 0 : 100000 + index * 10000,
      expense: 50000 + index * 5000,
      count: 2,
      unclassified: 0,
    })),
  };
}
async function appMenuTrigger(page: Page) {
  const mobile = page.getByRole('navigation', { name: 'Navegação móvel' });
  return (await mobile.isVisible())
    ? mobile.getByRole('button', { name: 'Mais', exact: true })
    : page.getByRole('button', { name: /^Menu do espaço:/ });
}
async function openAppMenu(page: Page) {
  const menu = page.getByRole('dialog', { name: 'Menu e preferências' });
  if (!(await menu.isVisible())) await (await appMenuTrigger(page)).click();
}
async function openWorkspaceSwitcher(page: Page) {
  await openAppMenu(page);
  await page
    .getByRole('dialog', { name: 'Menu e preferências' })
    .getByRole('link', { name: 'Trocar de espaço', exact: true })
    .click();
}
async function chooseTheme(page: Page, theme: string) {
  const control = page.getByRole('button', { name: `Tema ${theme}`, exact: true }).first();
  if (await control.isVisible()) {
    await control.click();
    return;
  }
  await openAppMenu(page);
  await page
    .getByRole('dialog', { name: 'Menu e preferências' })
    .getByRole('button', { name: `Tema ${theme}`, exact: true })
    .click();
  await page
    .getByRole('dialog', { name: 'Menu e preferências' })
    .getByRole('button', { name: 'Fechar', exact: true })
    .click();
}
test('sign-in themes and accessible form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Bom ter você por aqui.' })).toBeVisible();
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await chooseTheme(page, 'claro');
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
    await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
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
    await fillControl(page.getByRole('dialog').getByLabel('Nome da conta'), 'Nova conta');
    await page.getByRole('button', { name: 'Tema claro', exact: true }).isVisible();
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goto('/transactions');
    await expect(page.getByRole('button', { name: /Compra de supermercado/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.goto('/imports');
    await expect(page.getByRole('heading', { name: /Seus movimentos/ })).toBeVisible();
    await chooseSelect(page.getByLabel('Conta de destino'), account.id);
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
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await openWorkspaceSwitcher(page);
  await page.getByRole('button', { name: 'Criar espaço', exact: true }).click();
  await fillControl(page.getByLabel('Nome do espaço'), 'Meu negócio');
  await page.getByRole('button', { name: 'Azul', exact: true }).click();
  const selectedRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/v1/dashboard') &&
      request.headers()['x-workspace-id'] === '55555555-5555-4555-8555-555555555555',
  );
  await page.getByRole('button', { name: 'Criar e abrir espaço' }).click();
  await selectedRequest;
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
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
    await fillControl(page.getByLabel('Mês do planejamento'), month);
    await expect(
      page.getByRole('heading', { name: 'Planejamento mensal', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('-R$ 50,00', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Editar planejamento', exact: true }).click();
    await fillControl(page.getByLabel('Previsto · Alimentação'), '600,00');
    await fillControl(page.getByLabel('Notas do mês'), 'Notas preservadas');
    await page.getByRole('button', { name: 'Salvar planejamento', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(saved).toBe(true);
    await expect(page.getByText('Notas preservadas', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Mais ações do planejamento', exact: true }).click();
    await page.getByRole('button', { name: 'Copiar mês anterior', exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('substituídos');
    await page.getByRole('button', { name: 'Confirmar cópia do planejamento' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await chooseTheme(page, 'claro');
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
  await fillControl(page.getByRole('searchbox', { name: 'Buscar no extrato' }), 'does-not-exist');
  await expect(page.getByText(transaction.description, { exact: true })).toHaveCount(0);
  await fillControl(page.getByRole('searchbox', { name: 'Buscar no extrato' }), '2026-01-01');
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
  await chooseSelect(page.getByLabel('Conta de destino'), account.id);
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
  await chooseSelect(page.getByLabel('Conta de destino'), account.id);
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
  await chooseSelect(page.getByLabel('Conta de destino'), account.id);
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
  await chooseSelect(page.getByLabel('Conta de destino'), account.id);
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
        return route.fulfill({
          json: {
            id,
            status: 'confirmed',
            count: 1,
            reconciled: 0,
            skippedDuplicates: 1,
            balanceBefore: 1000,
            balanceAfter: 5912,
            referenceStatus: 'applied',
          },
        });
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
    if (outcome === 'normal') {
      await expect(page.getByRole('region', { name: 'Resultado da confirmação' })).toContainText(
        'R$ 59,12',
      );
      await expect(page.getByRole('region', { name: 'Resultado da confirmação' })).toContainText(
        'saldo final do extrato Mercado Pago',
      );
    }
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
    await fillControl(page.getByRole('dialog').getByLabel('Nome', { exact: true }), 'Casa');
    await page.getByRole('button', { name: 'Criar grupo', exact: true }).click();
    await expect(
      page.getByRole('tabpanel').getByRole('heading', { name: 'Casa', exact: true }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Adicionar categoria', exact: true }).click();
    await fillControl(page.getByRole('dialog').getByLabel('Nome', { exact: true }), 'Luz');
    await expectControlValue(
      page.getByRole('dialog').getByRole('combobox', { name: 'Grupo', exact: true }),
      groups[0].id,
    );
    await page.getByRole('button', { name: 'Criar categoria', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('tabpanel').getByText('Luz', { exact: true })).toBeVisible();
    for (const theme of ['claro', 'escuro']) {
      await chooseTheme(page, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `/tmp/mywallet-categories-${theme}-${width}.png`,
        fullPage: true,
      });
    }
    await page.goto('/transactions?new=1');
    await page
      .getByRole('dialog')
      .getByRole('combobox', { name: 'Categoria', exact: true })
      .click();
    await expect(page.getByRole('listbox').locator('[data-group="Casa"]')).toHaveText('Luz');
    await chooseSelect(
      page.getByRole('dialog').getByRole('combobox', { name: 'Categoria', exact: true }),
      categories[0].id,
    );
    await expectControlValue(
      page.getByRole('dialog').getByRole('combobox', { name: 'Categoria', exact: true }),
      categories[0].id,
    );
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
  await chooseSelect(page.getByLabel('Categoria do movimento 2'), categoryId);
  await expectControlValue(page.getByLabel('Categoria do movimento 2'), categoryId);
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
  await expectControlValue(page.getByLabel('Tipo do movimento 1'), 'income');
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
    page
      .locator('.notification-viewport')
      .getByText('Importação reprocessada. Confira o resultado antes de confirmar.', {
        exact: true,
      }),
  ).toBeVisible();
  expect(saved).toBe(1);
  await expectControlValue(page.getByLabel('Tipo do movimento 1'), 'transfer');
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
      await chooseTheme(page, theme);
      const dot = page
        .locator('.category-row')
        .filter({ has: page.getByRole('button', { name: 'Editar categoria Luz', exact: true }) })
        .locator('.category-type-dot');
      expect(await dot.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
        theme === 'claro' ? 'rgb(184, 75, 85)' : 'rgb(234, 160, 167)',
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
    await expectControlValue(page.getByRole('dialog').locator('input[type=color]'), '#123456');
    await page.getByRole('button', { name: 'Restaurar cor padrão', exact: true }).click();
    await expectControlValue(page.getByRole('dialog').locator('input[type=color]'), '#f28a97');
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('tab').first().focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: /Casa/ })).toBeFocused();
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab').first()).toHaveAttribute('aria-selected', 'true');
    await fillControl(page.getByRole('textbox', { name: 'Buscar grupos e categorias' }), 'Luz');
    await expect(
      page.getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toBeVisible();
    await fillControl(page.getByRole('textbox', { name: 'Buscar grupos e categorias' }), '');
    await expect(
      page.getByRole('button', { name: 'Editar categoria Luz', exact: true }),
    ).toHaveCount(0);
    await page.getByRole('tab', { name: /Casa/ }).click();
    await page.getByRole('button', { name: 'Adicionar categoria', exact: true }).click();
    await fillControl(page.getByRole('dialog').getByLabel('Nome', { exact: true }), 'Água');
    await page.getByRole('button', { name: 'Criar categoria', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(saved).toMatchObject({ type: 'expense', color: '#f28a97', groupId: groups[0].id });
    await page.getByRole('button', { name: 'Receitas', exact: true }).click();
    await expect(page.getByRole('tab').first()).toContainText('Geral');
    await page.getByRole('button', { name: 'Adicionar categoria', exact: true }).click();
    await fillControl(page.getByRole('dialog').getByLabel('Nome', { exact: true }), 'Salário');
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
    await fillControl(page.getByLabel('Saldo atual correto (R$)'), '192,20');
    await fillControl(page.getByLabel('Motivo da correção'), 'Saldo conferido no Meu Alelo');
    await expect(page.getByText('Diferença a registrar: R$ 72,20')).toBeVisible();
    let posted = 0;
    await page.route(`**/v1/accounts/${benefit.id}/balance-adjustments`, async (route) => {
      posted++;
      expect(route.request().postDataJSON()).toEqual({
        targetBalance: 19220,
        expectedBalance: 12000,
        expectedVersion: benefit.version,
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
    await chooseSelect(page.getByLabel('Conta de destino'), benefit.id);
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
  await chooseSelect(page.getByLabel('Origem da devolução 1'), transaction.id);
  await expect(
    page.getByText('Devolução vinculada · reduz a categoria original', { exact: true }),
  ).toBeVisible();
  await expectControlValue(page.getByLabel('Tipo do movimento 1'), 'expense');
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
  await dialog.getByLabel('Instituição').click();
  await expect(page.getByRole('listbox').getByRole('option')).toHaveText(['Alelo', 'Mercado Pago']);
  await chooseSelect(dialog.getByLabel('Instituição'), 'alelo');
  await expectControlValue(dialog.getByRole('combobox', { name: /^Tipo/ }), 'benefit_food');
  await chooseSelect(dialog.getByLabel('Instituição'), 'mercado_pago');
  await expectControlValue(dialog.getByRole('combobox', { name: /^Tipo/ }), 'checking');
  await fillControl(dialog.getByLabel('Nome da conta'), 'Imported wallet');
  await dialog.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toEqual({
    name: 'Imported wallet',
    institution: 'mercado_pago',
    type: 'checking',
  });
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  await fillControl(dialog.getByLabel('Nome da conta'), 'Renamed account');
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
  await fillControl(dialog.getByLabel('Valor (R$)'), '12,50');
  await fillControl(dialog.getByLabel('Descrição', { exact: true }), 'Supermercado Exemplo');
  await fillControl(dialog.getByLabel('Data', { exact: true }), '2025-01-01');
  await expect(dialog.getByLabel('Data', { exact: true })).not.toHaveAttribute('min', /.+/);
  await chooseSelect(
    dialog.getByRole('combobox', { name: 'Categoria', exact: true }),
    automationCategory.id,
  );
  await dialog
    .locator('summary')
    .filter({ hasText: /^Pessoa ou estabelecimento/ })
    .click();
  await chooseSelect(
    dialog.getByRole('combobox', { name: 'Pessoa ou estabelecimento', exact: true }),
    'new',
  );
  await fillControl(dialog.getByLabel('Nome da pessoa ou estabelecimento'), 'Supermercado Exemplo');
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
    await chooseSelect(
      page.getByRole('combobox', { name: 'Conta da relação', exact: true }),
      account.id,
    );
    await page.getByRole('combobox', { name: 'Origem da identificação', exact: true }).click();
    await expect(page.getByRole('listbox').locator('[data-value="settlement"]')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await fillControl(
      page.getByLabel('Descrição como aparece no extrato', { exact: true }),
      'Pix enviado Mercado Exemplo',
    );
    await chooseSelect(
      page.getByRole('combobox', { name: 'Categoria da relação', exact: true }),
      automationCategory.id,
    );
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
    await chooseTheme(page, 'claro');
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
  await chooseSelect(
    page.getByRole('combobox', { name: 'Pessoa ou estabelecimento', exact: true }),
    automationAgent.id,
  );
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
    await fillControl(dialog.getByLabel('Valor (R$)'), '25,00');
    await fillControl(
      dialog.getByLabel('Descrição', { exact: true }),
      'Pagamento cartão Maria Oliv',
    );
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
    await expectControlValue(
      dialog.getByRole('combobox', { name: 'Pessoa ou estabelecimento', exact: true }),
      maria.id,
    );
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
  await chooseSelect(
    page.getByRole('combobox', { name: 'Conta da descrição', exact: true }),
    account.id,
  );
  await fillControl(
    page.getByLabel('Nova descrição do extrato', { exact: true }),
    'Pagamento cartão Maria Oliveira',
  );
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

for (const width of [390, 1440])
  test(`corrects and undoes the balance base in its own history at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1100 });
    const a = {
      ...account,
      balance: 4605,
      openingBalance: 0,
      balanceBasis: { kind: 'unknown', originId: undefined as string | undefined },
    };
    const auditId = '77777777-7777-4777-8777-777777777777';
    let corrected = false,
      financialWrites = 0;
    await page.route('**/v1/accounts', (route) => route.fulfill({ json: [a] }));
    await page.route('**/v1/transactions', (route) => {
      if (route.request().method() !== 'GET') financialWrites++;
      return route.fulfill({ json: { items: [], nextCursor: null } });
    });
    await page.route(`**/v1/accounts/${a.id}/balance-adjustments`, (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        targetBalance: 5912,
        expectedBalance: 4605,
        expectedVersion: 1,
      });
      corrected = true;
      a.balance = 5912;
      a.openingBalance = 1307;
      a.version = 2;
      a.balanceBasis = { kind: 'manual', originId: auditId };
      return route.fulfill({
        json: { id: auditId, operation: 'manual', previousBase: 0, newBase: 1307 },
      });
    });
    await page.route(`**/v1/accounts/${a.id}/balance-history`, (route) =>
      route.fulfill({
        json: corrected
          ? [
              {
                id: auditId,
                accountId: a.id,
                operation: 'manual',
                previousBase: 0,
                newBase: 1307,
                reason: 'Saldo conferido no banco',
                createdAt: '2026-10-30T12:00:00Z',
                details: { targetBalance: 5912 },
                previousBasis: { kind: 'unknown' },
                newBasis: { kind: 'manual', originId: auditId },
                undoOfId: null,
              },
            ]
          : [],
      }),
    );
    await page.route(`**/v1/accounts/${a.id}/balance-adjustments/${auditId}/reversals`, (route) => {
      expect(route.request().headers()['if-match']).toBe('2');
      a.balance = 4605;
      a.openingBalance = 0;
      a.version = 3;
      a.balanceBasis = { kind: 'unknown', originId: undefined };
      return route.fulfill({ json: { id: 'undone' } });
    });
    await page.goto('/accounts');
    await page.getByRole('button', { name: 'Corrigir saldo', exact: true }).click();
    await fillControl(page.getByLabel('Saldo atual correto (R$)'), '59,12');
    await fillControl(page.getByLabel('Motivo da correção'), 'Saldo conferido no banco');
    await expect(page.getByText(/Nenhum lançamento financeiro será criado/)).toBeVisible();
    page.once('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Registrar correção de saldo', exact: true }).click();
    await expect(page.getByText('R$ 59,12', { exact: true })).toBeVisible();
    await page.getByText('Referência e histórico', { exact: true }).click();
    await page.getByRole('button', { name: 'Histórico de saldo', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Histórico de saldo' });
    await expect(dialog.getByText('Saldo conferido no banco', { exact: true })).toBeVisible();
    page.once('dialog', (prompt) => prompt.accept());
    await dialog.getByRole('button', { name: 'Desfazer correção', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('R$ 46,05', { exact: true })).toBeVisible();
    expect(financialWrites).toBe(0);
  });

test('offers optional current balance after a balance-less import without requiring starting fields', async ({
  page,
}) => {
  await signedIn(page);
  const id = '88888888-8888-4888-8888-888888888888';
  const a = {
    ...account,
    institution: 'alelo',
    type: 'benefit_food',
    balance: 70000,
    balanceBasis: { kind: 'unknown' },
  };
  const batch = {
    id,
    accountId: a.id,
    fileName: 'alelo.pdf',
    version: 2,
    status: 'confirmed',
    reportType: 'benefit_statement',
    canIntegrate: true,
    canReprocess: false,
    openingBalance: null,
    closingBalance: null,
    openingMismatch: false,
    balanceBasis: { kind: 'unknown' },
    items: [],
  };
  await page.route(`**/v1/accounts/${a.id}`, (route) => route.fulfill({ json: a }));
  await page.route(`**/v1/imports/${id}`, (route) => route.fulfill({ json: batch }));
  let writes = 0;
  await page.route(`**/v1/accounts/${a.id}/balance-adjustments`, (route) => {
    writes++;
    return route.fulfill({ json: { id: 'audit' } });
  });
  await page.goto(`/imports/${id}`);
  await expect(page.getByText('Quer alinhar o saldo da conta?', { exact: true })).toBeVisible();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Informar saldo atual (opcional)', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Conferir saldo atual' });
  await expect(dialog.getByLabel('Saldo atual correto (R$)')).toBeVisible();
  await expect(dialog.getByLabel('Saldo inicial (R$)')).toHaveCount(0);
  await expect(dialog.getByLabel('Data inicial')).toHaveCount(0);
});

for (const width of [360, 390, 768, 1440]) {
  test(`overview separates current balances from month analysis and preserves drilldown at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    const benefit = {
      ...account,
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Alelo',
      type: 'benefit_food',
      balance: 23000,
    };
    const reserve = {
      ...account,
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Cofrinho',
      type: 'reserve',
      balance: 20,
    };
    await page.route('**/v1/dashboard?*', (route) => {
      const from = new URL(route.request().url()).searchParams.get('from');
      return route.fulfill({
        json: {
          balance: 5912,
          benefitBalance: 23000,
          reserveBalance: 20,
          income: from === '2026-09-01' ? 10000 : 496635,
          expense: from === '2026-09-01' ? 12000 : 509704,
          unclassified: 0,
          accounts: [{ ...account, balance: 5912 }, benefit, reserve],
          expenseGroups: [{ groupId: null, name: 'Outros', amount: 12000, count: 3 }],
          coverage: 'tracked-accounts',
        },
      });
    });
    await page.route('**/v1/planning/*', (route) =>
      route.fulfill({
        json: monthlyPlan(new URL(route.request().url()).pathname.split('/').pop()!),
      }),
    );
    await page.goto('/?month=2026-09');
    await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
    await expect(page.locator('.sidebar')).toHaveCount(0);
    await expect(page.locator('.hero-balance')).toHaveText('R$ 59,12');
    await expect(page.getByRole('region', { name: 'Saldos atuais' })).toContainText('R$ 230,00');
    await expect(page.getByRole('region', { name: 'Saldos atuais' })).toContainText('R$ 0,20');
    await expect(page.getByRole('link', { name: 'Ver movimentos do período' })).toContainText(
      '-R$ 20,00',
    );
    await expect(page.locator('.month-result-note')).toContainText(
      'As despesas superaram as receitas',
    );
    await expect(page.locator('.month-metric.expense')).toContainText('R$ 500,00');
    await page
      .getByRole('group', { name: 'Conteúdo da visão geral' })
      .getByRole('button', { name: 'Análise', exact: true })
      .click();
    await expect(page.locator('.expense-groups')).toContainText('Outros');
    await page
      .getByRole('group', { name: 'Conteúdo da visão geral' })
      .getByRole('button', { name: 'Resumo', exact: true })
      .click();
    await page.getByText('Composição por conta', { exact: false }).click();
    await expect(page.locator('.balance-composition .account-line')).toHaveCount(3);
    await page.getByRole('button', { name: 'Ocultar valores', exact: true }).click();
    await expect(page.locator('.hero-balance')).toHaveText('••••••');
    await expect(page.locator('.monthly-analysis')).not.toContainText('R$');
    await expect(page.locator('.balance-composition')).not.toContainText('R$');
    await page.getByRole('button', { name: 'Mostrar valores', exact: true }).click();
    await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
    await expectControlValue(page.getByLabel('Mês do resumo'), '2026-08');
    await expect(page.locator('.hero-balance')).toHaveText('R$ 59,12');
    await page.goBack();
    await expectControlValue(page.getByLabel('Mês do resumo'), '2026-09');
    for (const theme of ['claro', 'escuro']) {
      await chooseTheme(page, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `/tmp/mywallet-overview-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    await page.getByRole('link', { name: 'Ver despesas do período', exact: true }).click();
    await expect(page).toHaveURL(/from=2026-09-01.*to=2026-09-30.*type=expense/);
    await expectControlValue(page.getByLabel('De', { exact: true }), '2026-09-01');
    await expectControlValue(page.getByLabel('Até', { exact: true }), '2026-09-30');
    await page.goBack();
    await page.getByRole('link', { name: 'Abrir planejamento deste mês', exact: true }).click();
    await expectControlValue(page.getByLabel('Mês do planejamento'), '2026-09');
  });
}

test('overview preserves balances when historical analysis fails and supports retry', async ({
  page,
}) => {
  await signedIn(page);
  let failing = true;
  await page.route('**/v1/dashboard?*', (route) => {
    if (new URL(route.request().url()).searchParams.get('from') === '2020-02-01' && failing)
      return route.fulfill({ status: 503, json: { message: 'Synthetic unavailable period' } });
    return route.fulfill({
      json: {
        balance: 5912,
        benefitBalance: 0,
        reserveBalance: 0,
        income: 0,
        expense: 0,
        unclassified: 0,
        accounts: [{ ...account, balance: 5912 }],
        expenseGroups: [],
        coverage: 'tracked-accounts',
      },
    });
  });
  await page.goto('/?month=2020-02');
  await expect(page.locator('.hero-balance')).toHaveText('R$ 59,12');
  await expect(page.getByRole('alert')).toContainText('Não foi possível carregar');
  failing = false;
  await page.getByRole('button', { name: 'Tentar novamente', exact: true }).click();
  await page
    .getByRole('group', { name: 'Conteúdo da visão geral' })
    .getByRole('button', { name: 'Análise', exact: true })
    .click();
  await expect(page.locator('.expense-groups')).toContainText('Nenhuma despesa registrada');
  await expect(page.getByRole('alert')).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`navigation menu restores keyboard focus and exposes secondary tools at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    const trigger = await appMenuTrigger(page);
    await trigger.focus();
    await page.keyboard.press('Enter');
    const menu = page.getByRole('dialog', { name: 'Menu e preferências' });
    await expect(menu.getByRole('link', { name: 'Importar extrato', exact: true })).toBeVisible();
    await expect(menu.getByRole('button', { name: 'Sair da conta', exact: true })).toBeVisible();
    await menu.getByRole('button', { name: 'Tema claro', exact: true }).click();
    await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });
}

for (const width of [360, 768, 1440])
  test(`monthly charts switch range, format and category view while preserving privacy at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/v1/dashboard?*', (route) =>
      route.fulfill({
        json: {
          balance: 5912,
          benefitBalance: 0,
          reserveBalance: 0,
          income: 100000,
          expense: 50000,
          unclassified: 0,
          accounts: [account],
          expenseGroups: [{ groupId: 'g', name: 'Casa', amount: 50000, count: 2 }],
          expenseCategories: [
            { categoryId: 'c', name: 'Luz', groupName: 'Casa', amount: 50000, count: 2 },
          ],
        },
      }),
    );
    await page.goto('/?month=2026-10&view=analysis');
    const history = page.getByRole('region', { name: 'Evolução mensal', exact: true });
    await expect(history.locator('svg g[role="button"]')).toHaveCount(4);
    await history.getByRole('button', { name: '7 meses', exact: true }).click();
    await expect(history.locator('svg g[role="button"]')).toHaveCount(7);
    await history.getByRole('button', { name: 'Linhas', exact: true }).click();
    await expect(history.locator('polyline')).toHaveCount(2);
    await history.getByRole('button', { name: '12 meses', exact: true }).click();
    await expect(history.locator('svg g[role="button"]')).toHaveCount(12);
    await history.getByText('Ver valores mês a mês', { exact: true }).click();
    await expect(history.locator('tbody tr')).toHaveCount(12);
    await page
      .getByRole('group', { name: 'Organização das despesas' })
      .getByRole('button', { name: 'Categorias', exact: true })
      .click();
    await expect(page.locator('.expense-group-list')).toContainText('Luz');
    await page.getByRole('button', { name: 'Ocultar valores', exact: true }).click();
    await expect(history.locator('svg.history-chart')).toHaveCount(0);
    await expect(history).not.toContainText('R$');
    await expect(page.locator('.expense-group-track')).toHaveCount(0);
    await page.getByRole('button', { name: 'Mostrar valores', exact: true }).click();
    await expect(history.locator('svg.history-chart')).toBeVisible();
    await history.locator('svg g[role="button"]').first().focus();
    await page.keyboard.press('Enter');
    await expect(history.locator('.history-selection')).toContainText('novembro de 2025');
    await history.getByRole('button', { name: 'Abrir mês', exact: true }).click();
    await expectControlValue(page.getByLabel('Mês do resumo'), '2025-11');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('a sole active space opens automatically without a saved selection; multiple spaces retain selection screen', async ({
  page,
}) => {
  await signedIn(page, false);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Visão geral', exact: true })).toBeVisible();
  await openWorkspaceSwitcher(page);
  await expect(page.getByRole('heading', { name: 'Seus espaços.' })).toBeVisible();
  await page.route('**/v1/workspaces', (route) =>
    route.fulfill({
      json: [
        workspace,
        {
          ...workspace,
          id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          name: 'Outro',
          isDefault: false,
        },
      ],
    }),
  );
  await page.goto('/');
  await expect(page).toHaveURL(/\/workspaces$/);
});

for (const width of [390, 1440])
  test(`workspace removal has confirmation, retention and restoration at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    let deleted = false;
    const trashed = {
      ...workspace,
      deletedAt: new Date().toISOString(),
      deleteAfter: new Date(Date.now() + 7 * 86400000).toISOString(),
    };
    await page.route('**/v1/workspaces**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() === 'DELETE') {
        deleted = true;
        return route.fulfill({ json: trashed });
      }
      if (path.endsWith('/restorations')) {
        deleted = false;
        return route.fulfill({ json: workspace });
      }
      if (path.endsWith('/trash')) return route.fulfill({ json: deleted ? [trashed] : [] });
      return route.fulfill({ json: deleted ? [] : [workspace] });
    });
    await page.goto('/workspaces');
    await page.getByRole('button', { name: 'Excluir espaço Pessoal', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Excluir espaço?' });
    await expect(dialog).toContainText('7 dias');
    await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
    expect(deleted).toBe(false);
    await page.getByRole('button', { name: 'Excluir espaço Pessoal', exact: true }).click();
    await page.getByRole('button', { name: 'Mover para a lixeira', exact: true }).click();
    await expect(page.getByRole('link', { name: 'Abrir espaço Pessoal', exact: true })).toHaveCount(
      0,
    );
    await page.locator('.workspace-trash summary').click();
    await expect(page.locator('.workspace-trash')).toContainText('Disponível para restaurar até');
    await page.getByRole('button', { name: 'Restaurar', exact: true }).click();
    await expect(
      page.getByRole('link', { name: 'Abrir espaço Pessoal', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

for (const width of [320, 430, 1024, 1280, 1920])
  test(`premium layout and bank source at ${width}px`, async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 900 });
    const bank = {
      ...account,
      balance: 5912,
      balanceBasis: {
        kind: 'statement',
        referencePoint: 'closing',
        referenceDate: '2026-10-30',
        referenceBalance: 5912,
        referenceKey: 'a'.repeat(64),
        originId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        importId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        reviewRequired: false,
      },
    };
    await page.route('**/v1/accounts', (route) => route.fulfill({ json: [bank] }));
    await page.route('**/v1/dashboard?*', (route) =>
      route.fulfill({
        json: {
          balance: 5912,
          benefitBalance: 0,
          reserveBalance: 0,
          income: 100000,
          expense: 50000,
          unclassified: 0,
          accounts: [bank],
          expenseGroups: [],
          expenseCategories: [],
        },
      }),
    );
    await page.goto('/');
    await expect(page.locator('.current-balances')).toContainText('Referência do extrato');
    await expect(
      page.getByRole('link', { name: 'Ver origem', exact: true }).filter({ visible: true }),
    ).toHaveAttribute('href', '/imports/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
    const privacy = page.getByRole('button', { name: 'Ocultar valores', exact: true });
    const box = await privacy.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
    for (const theme of ['claro', 'escuro']) {
      await chooseTheme(page, theme);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({
        path: `/tmp/mywallet-premium-home-${width}-${theme}.png`,
        fullPage: true,
      });
    }
    await page.goto('/accounts');
    await page.getByText('Referência e histórico', { exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Atualizar por extratos', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/mywallet-premium-accounts-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
    await fillControl(page.getByLabel('Nome da conta'), 'Conta com texto preservado');
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Adicionar conta', exact: true }),
    ).toBeInViewport();
    if (width <= 700) {
      await page.setViewportSize({ width, height: 480 });
      const dialog = await page.getByRole('dialog').boundingBox();
      expect(dialog!.height).toBeLessThanOrEqual(480);
      await expectControlValue(page.getByLabel('Nome da conta'), 'Conta com texto preservado');
    }
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goto('/workspaces');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

test('transaction detail panel preserves URL filters and browser back', async ({ page }) => {
  await signedIn(page);
  await page.route(`**/v1/transactions/${transaction.id}`, (route) =>
    route.fulfill({ json: transaction }),
  );
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('/transactions?from=2026-10-01&to=2026-10-31&type=expense');
  await fillControl(page.getByLabel('Buscar movimentos'), 'supermercado');
  await page.getByRole('button', { name: /Compra de supermercado/ }).click();
  await expect(page.locator('.dialog-detail')).toBeVisible();
  await expectControlValue(page.getByLabel('Descrição', { exact: true }), transaction.description);
  await page.goBack();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expectControlValue(page.getByLabel('Buscar movimentos'), 'supermercado');
  await expectControlValue(page.getByLabel('De', { exact: true }), '2026-10-01');
});

test('bulk category review affects only visible editable rows and keeps duplicate touch targets locked', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 900 });
  const categoryId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  await page.route('**/v1/categories', (route) =>
    route.fulfill({
      json: [
        {
          id: categoryId,
          name: 'Casa',
          type: 'expense',
          color: '#f28a97',
          groupName: 'Geral',
          groupId: null,
        },
      ],
    }),
  );
  const items = [
    {
      ...transaction,
      id: '11111111-aaaa-4111-8111-111111111111',
      description: 'Luz da casa',
      sourceRow: 1,
      amount: -100,
      selected: true,
      duplicateLocked: false,
      duplicateCandidate: false,
      action: 'create',
      transactionType: 'expense',
      categoryId: null as string | null,
      metadata: null,
      candidateDescriptions: [],
      linkedTransactionId: null,
    },
    {
      ...transaction,
      id: '22222222-aaaa-4222-8222-222222222222',
      description: 'Mercado',
      sourceRow: 2,
      amount: -200,
      selected: true,
      duplicateLocked: false,
      duplicateCandidate: false,
      action: 'create',
      transactionType: 'expense',
      categoryId: null as string | null,
      metadata: null,
      candidateDescriptions: [],
      linkedTransactionId: null,
    },
    {
      ...transaction,
      id: '33333333-aaaa-4333-8333-333333333333',
      description: 'Duplicata',
      sourceRow: 3,
      amount: -100,
      selected: false,
      duplicateLocked: true,
      duplicateCandidate: true,
      action: 'recorded',
      transactionType: 'expense',
      categoryId: null as string | null,
      metadata: null,
      candidateDescriptions: [],
      linkedTransactionId: transaction.id,
    },
  ];
  const batch = {
    id,
    accountId: account.id,
    institution: 'mercado_pago',
    status: 'draft',
    version: 1,
    canIntegrate: true,
    canReprocess: false,
    sourceFormat: 'csv',
    fileName: 'synthetic.csv',
    reportType: 'account_statement',
    openingBalance: 1000,
    closingBalance: 600,
    openingMismatch: false,
    reconciliationCapability: 'running_balance',
    items,
  };
  let writes = 0;
  await page.route(`**/v1/imports/${id}**`, (route) => {
    if (route.request().method() === 'POST') {
      expect(new URL(route.request().url()).pathname).toBe(`/v1/imports/${id}/items/reviews`);
      const body = route.request().postDataJSON();
      expect(body.itemIds).toEqual([items[0].id]);
      expect(body.categoryId).toBe(categoryId);
      items[0].categoryId = categoryId;
      batch.version++;
      writes++;
    }
    return route.fulfill({ json: batch });
  });
  await page.goto(`/imports/${id}`);
  const target = await page.locator('.review-select-target').first().boundingBox();
  expect(target!.width).toBeGreaterThanOrEqual(48);
  await expect(page.getByLabel('Selecionar movimento 3')).toBeDisabled();
  await fillControl(page.getByRole('searchbox', { name: 'Buscar no extrato' }), 'Luz');
  await page.locator('.import-bulk summary').click();
  await chooseSelect(page.getByLabel('Categoria do lote'), categoryId);
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Aplicar a 1 movimentos', exact: true }).click();
  await expect.poll(() => writes).toBe(1);
  expect(items[1].categoryId).toBeNull();
  await expectControlValue(page.getByLabel('Categoria do movimento 1'), categoryId);
});

test('premium accessibility with OS text scaling, reduced motion and narrow reflow', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setEmulatedOSTextScale', { scale: 2 });
  await page.goto('/');
  await expect(page.locator('.current-balances')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  await expect(
    page.getByRole('dialog').getByRole('button', { name: 'Adicionar conta', exact: true }),
  ).toBeInViewport();
  await fillControl(page.getByLabel('Nome da conta'), 'Conta com texto ampliado');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await cdp.send('Emulation.setEmulatedOSTextScale', { scale: 1 });
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 320,
    height: 720,
    deviceScaleFactor: 4,
    mobile: false,
  });
  await page.goto('/');
  await expect(page.locator('.current-balances')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('legacy accounts keep their institution and balance when renamed', async ({ page }) => {
  await signedIn(page);
  const legacy = { ...account, institution: 'nubank', name: 'Conta anterior' };
  let saved: Record<string, unknown> | undefined;
  await page.route('**/v1/accounts', (route) => route.fulfill({ json: [legacy] }));
  await page.route(`**/v1/accounts/${account.id}`, (route) => {
    saved = route.request().postDataJSON();
    return route.fulfill({ json: { ...legacy, ...saved } });
  });
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByLabel('Instituição')).toBeDisabled();
  await expectControlValue(dialog.getByLabel('Instituição'), 'nubank');
  await fillControl(dialog.getByLabel('Nome da conta'), 'Conta preservada');
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved).toEqual({ name: 'Conta preservada', institution: 'nubank', type: account.type });
});

function commitmentsFixture(month = '2026-11', populated = false) {
  const rule = {
    id: '55555555-5555-4555-8555-555555555555',
    accountId: account.id,
    categoryId: null,
    description: 'Internet residencial',
    amount: 9000,
    transactionType: 'expense',
    frequency: 'monthly',
    startDate: `${month}-10`,
    endDate: null,
    endedOn: null,
    version: 1,
  };
  return {
    today: `${month}-15`,
    month,
    through: `${month}-30`,
    schedules: populated ? [rule] : [],
    items: populated
      ? [
          {
            ...rule,
            scheduleId: rule.id,
            dueDate: `${month}-10`,
            status: 'overdue',
            transactionId: null,
            actualAmount: null,
          },
        ]
      : [],
    totalItems: populated ? 1 : 0,
    projection: [
      {
        accountId: account.id,
        name: account.name,
        kind: 'cash',
        balance: 10000,
        income: 0,
        expense: populated ? 9000 : 0,
        projected: populated ? 1000 : 10000,
        overdue: populated ? 1 : 0,
      },
    ],
    overdueCount: populated ? 1 : 0,
    overdueIncome: 0,
    overdueExpense: populated ? 9000 : 0,
  };
}
for (const width of [320, 390, 768, 1440])
  test(`commitments and cashflow remain usable at ${width}px`, async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 900 });
    const data = commitmentsFixture('2026-11', true);
    await page.route('**/v1/commitments?*', (route) => route.fulfill({ json: data }));
    await page.goto('/planning?view=commitments&month=2026-11');
    await expect(page.getByRole('heading', { name: 'Contas e recebimentos' })).toBeVisible();
    await expect(page.locator('.forecast-result')).toContainText('R$ 10,00');
    await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Adicionar compromisso', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/mywallet-commitment-form-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Pagar', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByRole('group', { name: 'Como concluir' }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `/tmp/mywallet-commitment-payment-${width}.png`,
      fullPage: false,
    });
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goto('/');
    await page.getByRole('button', { name: 'Ocultar valores', exact: true }).click();
    await expect(page.locator('.forecast-result strong')).toHaveText('••••••');
    await chooseTheme(page, 'claro');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('creates a monthly commitment with no opening balance or automatic financial posting', async ({
  page,
}) => {
  await signedIn(page);
  let saved: Record<string, unknown> | undefined;
  let receipt = '';
  await page.route('**/v1/commitments', (route) => {
    saved = route.request().postDataJSON();
    receipt = route.request().headers()['idempotency-key'];
    return route.fulfill({ json: { id: '55555555-5555-4555-8555-555555555555', ...saved } });
  });
  const financialWrites: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/v1/transactions'))
      financialWrites.push(r.url());
  });
  await page.goto('/planning?view=commitments&month=2026-11');
  await page.getByRole('button', { name: 'Novo compromisso', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await fillControl(dialog.getByLabel('Descrição', { exact: true }), 'Internet');
  await chooseSelect(dialog.getByRole('combobox', { name: /^Conta$/ }), account.id);
  await fillControl(dialog.getByLabel('Valor previsto (R$)', { exact: true }), '90,00');
  await fillControl(dialog.getByLabel('Primeiro vencimento', { exact: true }), '2026-11-10');
  await dialog.getByRole('button', { name: 'Adicionar compromisso', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved).toMatchObject({
    accountId: account.id,
    description: 'Internet',
    amount: 9000,
    frequency: 'monthly',
    transactionType: 'expense',
    startDate: '2026-11-10',
    categoryId: null,
  });
  expect(receipt).toBeTruthy();
  expect(financialWrites).toEqual([]);
});
test('links an imported payment without creating another transaction and preserves retry identity', async ({
  page,
}) => {
  await signedIn(page);
  const data = commitmentsFixture('2026-11', true);
  let attempts = 0;
  const keys: string[] = [];
  const bodies: unknown[] = [];
  await page.route('**/v1/commitments?*', (route) => route.fulfill({ json: data }));
  await page.route('**/v1/commitments/*/occurrences/*/candidates?*', (route) =>
    route.fulfill({
      json: [
        {
          ...transaction,
          description: 'Pagamento Internet',
          amount: -9000,
          transactionDate: '2026-11-10',
        },
      ],
    }),
  );
  await page.route('**/v1/commitments/*/occurrences/2026-11-10', (route) => {
    attempts++;
    keys.push(route.request().headers()['idempotency-key']);
    bodies.push(route.request().postDataJSON());
    if (attempts === 1)
      return route.fulfill({ status: 503, json: { title: 'Falha temporária. Tente novamente.' } });
    data.items[0].status = 'settled';
    data.items[0].transactionId = transaction.id as never;
    data.projection[0].expense = 0;
    data.projection[0].projected = 10000;
    return route.fulfill({
      json: {
        id: data.schedules[0].id,
        date: '2026-11-10',
        status: 'settled',
        transactionId: transaction.id,
      },
    });
  });
  const financialWrites: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/v1/transactions'))
      financialWrites.push(r.url());
  });
  await page.goto('/planning?view=commitments&month=2026-11');
  await page.getByRole('button', { name: 'Pagar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await chooseSelect(dialog.getByLabel('Lançamento realizado'), transaction.id);
  await dialog.getByRole('button', { name: 'Confirmar vínculo', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Falha temporária');
  await dialog.getByRole('button', { name: 'Confirmar vínculo', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(keys[0]).toBeTruthy();
  expect(keys[0]).toBe(keys[1]);
  expect(bodies[0]).toEqual({
    action: 'link',
    transactionId: transaction.id,
    transactionVersion: 1,
  });
  expect(financialWrites).toEqual([]);
  await expect(page.locator('.forecast-result')).toContainText('R$ 100,00');
});

test('registers the actual payment amount through the commitment workflow', async ({ page }) => {
  await signedIn(page);
  const data = commitmentsFixture('2026-11', true);
  let body: Record<string, unknown> | undefined;
  await page.route('**/v1/commitments?*', (route) => route.fulfill({ json: data }));
  await page.route('**/v1/commitments/*/occurrences/2026-11-10', (route) => {
    body = route.request().postDataJSON();
    data.items[0].status = 'settled';
    data.projection[0].expense = 0;
    data.projection[0].balance = 500;
    data.projection[0].projected = 500;
    return route.fulfill({ json: { status: 'settled', transactionId: transaction.id } });
  });
  await page.goto('/planning?view=commitments&month=2026-11');
  await page.getByRole('button', { name: 'Pagar', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Registrar pagamento', exact: true }).click();
  await fillControl(dialog.getByLabel('Data realizada', { exact: true }), '2026-10-30');
  await fillControl(dialog.getByLabel('Valor realizado (R$)', { exact: true }), '95,00');
  await dialog.getByRole('button', { name: 'Confirmar pagamento', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(body).toEqual({ action: 'create', transactionDate: '2026-10-30', amount: 9500 });
  await expect(page.locator('.forecast-result')).toContainText('R$ 5,00');
});

const financeCardId = '55555555-5555-4555-8555-555555555551';
const financeHoldingId = '77777777-7777-4777-8777-777777777771';
function cardsFixture() {
  return {
    today: '2026-11-01',
    cards: [
      {
        id: financeCardId,
        accountId: '66666666-6666-4666-8666-666666666661',
        paymentAccountId: account.id,
        name: 'Cartão pessoal',
        closingDay: 10,
        dueDay: 20,
        limit: 30000,
        archived: false,
        version: 1,
        balance: -12000,
        debt: 12000,
        credit: 0,
        availableLimit: 18000,
        limitExceeded: 0,
        selectedMonth: '2026-11',
        purchases: [
          {
            id: '55555555-5555-4555-8555-555555555552',
            cardId: financeCardId,
            categoryId: null,
            description: 'Compra de mercado',
            purchaseDate: '2026-10-31',
            amount: 12000,
            installments: 1,
            firstBillMonth: '2026-11',
            canceled: false,
            version: 1,
          },
        ],
        bills: [
          {
            id: '55555555-5555-4555-8555-555555555553',
            cardId: financeCardId,
            month: '2026-11',
            closingDate: '2026-11-10',
            dueDate: '2026-11-20',
            total: 12000,
            paid: 0,
            creditApplied: 0,
            remaining: 12000,
            state: 'open',
            entries: [
              {
                id: '55555555-5555-4555-8555-555555555554',
                cardId: financeCardId,
                purchaseId: '55555555-5555-4555-8555-555555555552',
                transactionId: transaction.id,
                billMonth: '2026-11',
                kind: 'purchase',
                installmentNumber: 1,
                amount: -12000,
                description: 'Compra de mercado · 1/1',
                active: true,
              },
            ],
            payments: [],
          },
        ],
      },
    ],
  };
}
function wealthFixture(populated = true) {
  const totals = {
    asOf: '2026-11-01',
    assets: populated ? 455678 : 345678,
    liabilities: populated ? 12000 : 0,
    netWorth: populated ? 443678 : 345678,
    cash: 345678,
    reserves: 0,
    investments: populated ? 110000 : 0,
    otherAssets: 0,
    cardCredit: 0,
    cardDebt: populated ? 12000 : 0,
    overdrafts: 0,
    otherDebts: 0,
    benefitsExcluded: 0,
  };
  return {
    ...totals,
    holdings: populated
      ? [
          {
            id: financeHoldingId,
            accountId: '88888888-8888-4888-8888-888888888881',
            name: 'CDB Reserva',
            provider: 'Custódia manual',
            productType: 'fixed_income',
            capital: 100000,
            marketValue: 110000,
            valuationDate: '2026-11-01',
            valuationMethod: 'manual',
            openedDate: '2026-11-01',
            lastEventId: null,
            archived: false,
            version: 1,
            unrealized: 10000,
            realized: 0,
            totalResult: 10000,
            stale: false,
            events: [],
          },
        ]
      : [],
    items: [],
    history: populated
      ? [
          {
            id: '99999999-9999-4999-8999-999999999991',
            kind: 'snapshot',
            createdAt: '2026-11-01T12:00:00Z',
            data: totals,
          },
        ]
      : [],
  };
}
async function financeFixtures(page: Page) {
  const cards = cardsFixture();
  const wealth = wealthFixture();
  await page.route('**/v1/cards?*', (r) => r.fulfill({ json: cards }));
  await page.route('**/v1/wealth', (r) => r.fulfill({ json: wealth }));
  await page.route('**/v1/wealth/overview', (r) => r.fulfill({ json: wealth }));
  return { cards, wealth };
}
for (const width of [320, 390, 768, 1440])
  test(`cards and wealth responsive workflows at ${width}px`, async ({ page }) => {
    await signedIn(page);
    await financeFixtures(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/cards?month=2026-11');
    await expect(
      page.getByRole('heading', { name: 'Cartões e faturas', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.credit-selector-item')).toContainText('R$ 120,00');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Registrar compra', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByLabel('Valor total da compra (R$)', { exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `/tmp/mywallet-card-purchase-${width}.png`, fullPage: false });
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.getByRole('button', { name: 'Pagar ou vincular', exact: true }).click();
    await expect(
      page.getByRole('dialog').getByRole('group', { name: 'Modo de pagamento da fatura' }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await page.goto('/wealth');
    await expect(
      page.getByRole('heading', { name: 'Investimentos e patrimônio', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('CDB Reserva', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Atualizar valor', exact: true }).click();
    await expect(
      page
        .getByRole('dialog')
        .getByLabel('Valor total atualizado da posição (R$)', { exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: `/tmp/mywallet-investment-value-${width}.png`, fullPage: false });
    await page.getByRole('button', { name: 'Fechar', exact: true }).click();
    await chooseTheme(page, 'claro');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: 'Evolução', exact: true }).click();
    await expect(page.locator('.wealth-chart')).toBeVisible();
    await page.getByRole('button', { name: 'Ocultar valores do patrimônio', exact: true }).click();
    await expect(page.locator('.wealth-chart')).toHaveCount(0);
    await expect(page.locator('.wealth-net-worth strong')).toHaveText('••••••');
  });
test('creates a credit card and sends an exact installment purchase without debiting the bank', async ({
  page,
}) => {
  await signedIn(page);
  const { cards } = await financeFixtures(page);
  const writes: unknown[] = [];
  await page.route('**/v1/cards', (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: cards.cards[0] });
  });
  await page.route('**/v1/cards/*/purchases', (route) => {
    writes.push(route.request().postDataJSON());
    return route.fulfill({ json: { ...cards.cards[0].purchases[0], firstBillMonth: '2026-11' } });
  });
  await page.goto('/cards?month=2026-11');
  await page.getByRole('button', { name: 'Novo cartão', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await fillControl(dialog.getByLabel('Nome do cartão', { exact: true }), 'Meu cartão');
  await chooseSelect(dialog.getByLabel('Conta para pagar a fatura', { exact: true }), account.id);
  await fillControl(dialog.getByLabel('Limite informado (R$)', { exact: true }), '2.500,00');
  await dialog.getByRole('button', { name: 'Adicionar cartão', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({
    name: 'Meu cartão',
    paymentAccountId: account.id,
    closingDay: 10,
    dueDay: 20,
    limit: 250000,
  });
  await page.getByRole('button', { name: 'Registrar compra', exact: true }).click();
  dialog = page.getByRole('dialog');
  await fillControl(dialog.getByLabel('Descrição da compra', { exact: true }), 'Compra parcelada');
  await fillControl(dialog.getByLabel('Valor total da compra (R$)', { exact: true }), '100,01');
  await fillControl(dialog.getByLabel('Quantidade de parcelas', { exact: true }), '3');
  await fillControl(dialog.getByLabel('Data da compra', { exact: true }), '2026-10-31');
  await fillControl(dialog.getByLabel('Primeira fatura (opcional)', { exact: true }), '2026-11');
  await dialog.getByRole('button', { name: 'Registrar compra', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toMatchObject({
    amount: 10001,
    installments: 3,
    firstBillMonth: '2026-11',
    purchaseDate: '2026-10-31',
  });
});
test('links a card payment from the statement with an idempotent retry', async ({ page }) => {
  await signedIn(page);
  const { cards } = await financeFixtures(page);
  const keys: string[] = [];
  const writes: unknown[] = [];
  await page.route('**/v1/cards/*/candidates?*', (r) =>
    r.fulfill({
      json: [
        {
          ...transaction,
          amount: -12000,
          description: 'Pagamento do cartão',
          transactionDate: '2026-10-31',
          managedKind: null,
          refundOfId: null,
        },
      ],
    }),
  );
  await page.route('**/v1/cards/*/bills/*/payments', (r) => {
    keys.push(r.request().headers()['idempotency-key']);
    writes.push(r.request().postDataJSON());
    if (keys.length === 1)
      return r.fulfill({ status: 503, json: { title: 'Tente confirmar novamente.' } });
    cards.cards[0].bills[0].remaining = 0;
    cards.cards[0].bills[0].paid = 12000;
    cards.cards[0].debt = 0;
    return r.fulfill({ json: { id: 'synthetic-payment' } });
  });
  await page.goto('/cards?month=2026-11');
  await page.getByRole('button', { name: 'Pagar ou vincular', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await chooseSelect(dialog.getByLabel('Saída do extrato', { exact: true }), transaction.id);
  await dialog.getByRole('button', { name: 'Vincular pagamento', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Tente confirmar');
  await dialog.getByRole('button', { name: 'Vincular pagamento', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(keys[0]).toBe(keys[1]);
  expect(writes[0]).toMatchObject({
    mode: 'link',
    amount: 12000,
    accountId: account.id,
    transactionId: transaction.id,
    transactionVersion: 1,
    date: '2026-10-31',
  });
});
test('values a holding without financial posting and records a redemption with separated capital', async ({
  page,
}) => {
  await signedIn(page);
  const { wealth } = await financeFixtures(page);
  const writes: Record<string, unknown>[] = [];
  await page.route('**/v1/wealth/holdings/*/operations', (r) => {
    const body = r.request().postDataJSON();
    writes.push(body);
    if (body.kind === 'valuation') wealth.holdings[0].marketValue = 120000;
    return r.fulfill({ json: wealth.holdings[0] });
  });
  await page.goto('/wealth');
  await page.getByRole('button', { name: 'Atualizar valor', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await fillControl(
    dialog.getByLabel('Valor total atualizado da posição (R$)', { exact: true }),
    '1.200,00',
  );
  await dialog.getByRole('button', { name: 'Salvar avaliação', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({ kind: 'valuation', marketValue: 120000 });
  expect(writes[0].accountId).toBeUndefined();
  await page.getByRole('button', { name: 'Ver detalhes', exact: false }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Resgate', exact: true }).click();
  dialog = page.getByRole('dialog');
  await chooseSelect(dialog.getByLabel('Conta da movimentação', { exact: true }), account.id);
  await fillControl(dialog.getByLabel('Valor líquido recebido (R$)', { exact: true }), '600,00');
  await dialog.getByRole('button', { name: 'Estimar capital proporcional', exact: true }).click();
  await expectControlValue(
    dialog.getByLabel('Capital que está sendo resgatado (R$)', { exact: true }),
    '500,00',
  );
  await expect(dialog.locator('.finance-review')).toContainText('R$ 100,00');
  await dialog.getByRole('button', { name: 'Registrar movimentação', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toMatchObject({
    kind: 'redemption',
    amount: 60000,
    capitalRemoved: 50000,
    accountId: account.id,
  });
});
test('registers an existing investment and an asset without duplicating a bank movement', async ({
  page,
}) => {
  await signedIn(page);
  const { wealth } = await financeFixtures(page);
  const writes: Record<string, unknown>[] = [];
  const financial: string[] = [];
  page.on('request', (r) => {
    if (r.method() === 'POST' && r.url().includes('/v1/transactions')) financial.push(r.url());
  });
  await page.route('**/v1/wealth/holdings', (r) => {
    writes.push(r.request().postDataJSON());
    return r.fulfill({ json: wealth.holdings[0] });
  });
  await page.route('**/v1/wealth/items', (r) => {
    writes.push(r.request().postDataJSON());
    return r.fulfill({ json: { id: 'asset' } });
  });
  await page.goto('/wealth');
  await page.getByRole('button', { name: 'Novo investimento', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await fillControl(
    dialog.getByLabel('Nome do investimento', { exact: true }),
    'Aplicação existente',
  );
  await fillControl(dialog.getByLabel('Capital já investido (R$)', { exact: true }), '1.000,00');
  await fillControl(dialog.getByLabel('Valor total atualizado (R$)', { exact: true }), '1.100,00');
  await dialog.getByRole('button', { name: 'Cadastrar investimento', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[0]).toMatchObject({ capital: 100000, marketValue: 110000 });
  await page.getByRole('button', { name: 'Bens e dívidas', exact: true }).click();
  await page.getByRole('button', { name: 'Adicionar posição', exact: true }).click();
  dialog = page.getByRole('dialog');
  await fillControl(dialog.getByLabel('Nome do bem ou dívida', { exact: true }), 'Moto');
  await fillControl(dialog.getByLabel('Valor atual informado (R$)', { exact: true }), '10.000,00');
  await dialog.getByRole('button', { name: 'Adicionar posição', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(writes[1]).toMatchObject({ name: 'Moto', kind: 'asset', value: 1000000 });
  expect(financial).toEqual([]);
});

test('links a historical investment movement already included in the current position', async ({
  page,
}) => {
  await signedIn(page);
  const { wealth } = await financeFixtures(page);
  let saved: Record<string, unknown> | undefined;
  await page.route('**/v1/wealth/holdings/*/candidates?*', (r) =>
    r.fulfill({
      json: [
        {
          ...transaction,
          description: 'Aporte antigo',
          amount: -10000,
          transactionDate: '2026-10-10',
          managedKind: null,
          refundedAmount: 0,
          refundOfId: null,
        },
      ],
    }),
  );
  await page.route('**/v1/wealth/holdings/*/operations', (r) => {
    saved = r.request().postDataJSON();
    return r.fulfill({ json: wealth.holdings[0] });
  });
  await page.goto('/wealth');
  await page.getByRole('button', { name: 'Ver detalhes', exact: false }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Aporte', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Já está no extrato', exact: true }).click();
  await chooseSelect(dialog.getByLabel('Conta da movimentação', { exact: true }), account.id);
  await chooseSelect(dialog.getByLabel('Movimento do extrato', { exact: true }), transaction.id);
  await dialog
    .getByLabel('Este movimento já está incluído na posição cadastrada', { exact: true })
    .check();
  await dialog.getByRole('button', { name: 'Registrar movimentação', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(saved).toMatchObject({
    kind: 'contribution',
    date: '2026-10-10',
    amount: 10000,
    includedInPosition: true,
    transactionId: transaction.id,
  });
  expect(saved?.marketValue).toBeUndefined();
});
test('cards and wealth support enlarged text and narrow reflow', async ({ page }) => {
  await signedIn(page);
  await financeFixtures(page);
  await page.setViewportSize({ width: 320, height: 850 });
  await page.goto('/cards?month=2026-11');
  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  await expect(page.getByRole('heading', { name: 'Cartões e faturas', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mywallet-cards-large-text.png', fullPage: true });
  await page.goto('/wealth');
  await page.addStyleTag({ content: 'html{font-size:200% !important}' });
  await expect(
    page.getByRole('heading', { name: 'Investimentos e patrimônio', exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '/tmp/mywallet-wealth-large-text.png', fullPage: true });
});

for (const width of [360, 1440])
  test(`benefit credit planning month is configurable and recalculates without changing bank dates at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    let following = false;
    let version = 1;
    const aleloId = '77777777-7777-4777-8777-777777777777';
    await page.route(`**/v1/accounts/${aleloId}/benefit-planning-month`, async (route) => {
      expect(route.request().method()).toBe('PATCH');
      expect(route.request().headers()['if-match']).toBe(String(version));
      const body = route.request().postDataJSON();
      following = body.benefitCreditMonth === 'following';
      version++;
      await route.fulfill({
        json: { ...account, id: aleloId, version, benefitCreditMonth: body.benefitCreditMonth },
      });
    });
    await page.route('**/v1/planning/**', async (route) => {
      const plan = monthlyPlan('2026-11');
      await route.fulfill({
        json: {
          ...plan,
          benefitAccounts: [
            {
              id: aleloId,
              name: 'Alelo VA',
              version,
              benefitCreditMonth: following ? 'following' : 'received',
            },
          ],
          totals: {
            ...plan.totals,
            plannedIncome: 70000,
            actualIncome: following ? 70000 : 0,
            incomeDifference: following ? 0 : -70000,
          },
        },
      });
    });
    await page.goto('/planning?month=2026-11');
    await page
      .getByText('Como os valores são calculados e configurações do VA/VR', { exact: true })
      .click();
    const notice = page.getByRole('region', { name: 'Competência do VA/VR' });
    const income = page.getByRole('article', { name: 'Receitas do mês', exact: true });
    await expect(income.getByText('R$ 0,00', { exact: true })).toBeVisible();
    await notice.getByRole('button', { name: 'Usar no mês seguinte' }).click();
    await expect(
      notice.getByText('Créditos de outubro de 2026 entram em novembro de 2026.'),
    ).toBeVisible();
    await expect(income.getByText('R$ 700,00', { exact: true })).toHaveCount(2);
    await page.reload();
    await page
      .getByText('Como os valores são calculados e configurações do VA/VR', { exact: true })
      .click();
    await expect(notice.getByRole('button', { name: 'Usar mês do recebimento' })).toBeVisible();
    await notice.getByRole('button', { name: 'Usar mês do recebimento' }).click();
    await expect(income.getByText('R$ 0,00', { exact: true })).toBeVisible();
    expect(following).toBe(false);
    expect(version).toBe(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

const redesignedRoutes = [
  ['/', 'Visão geral'],
  ['/?view=analysis', 'Visão geral'],
  ['/transactions', 'Movimentações'],
  ['/accounts', 'Minhas contas'],
  ['/planning', 'Planejamento mensal'],
  ['/planning?view=commitments', 'Contas e recebimentos'],
  ['/imports', 'Importar extrato'],
  ['/categories', 'Categorias'],
  ['/counterparties', 'Pessoas e estabelecimentos'],
  ['/cards', 'Cartões e faturas'],
  ['/wealth', 'Investimentos e patrimônio'],
  ['/settings', 'Preferências'],
  ['/workspaces', 'Seus espaços'],
] as const;
for (const width of [390, 1440])
  for (const theme of ['light', 'dark'])
    test(`shared interface remains usable across all routes at ${width}px in ${theme}`, async ({
      page,
    }, info) => {
      await signedIn(page);
      await page.addInitScript((value) => localStorage.setItem('mywallet-theme', value), theme);
      await page.setViewportSize({ width, height: 1000 });
      for (const [path, title] of redesignedRoutes) {
        await page.goto(path);
        const heading = page.getByRole('heading', {
          level: 1,
          name: title,
          exact: title !== 'Seus espaços',
        });
        await expect(heading).toBeVisible();
        await expect(page.locator('.page-header')).toHaveCount(1);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
          path,
        ).toBe(true);
        const action = page.locator('.page-header-actions button').first();
        if (await action.count()) {
          const target = await action.boundingBox();
          expect(target!.height, `${path}: primary action target`).toBeGreaterThanOrEqual(44);
        }
        await page.screenshot({
          path: info.outputPath(`${path.replace(/[^a-z0-9]/gi, '_') || 'overview'}.png`),
          fullPage: true,
        });
      }
    });
test('additional finance modules are discoverable from the shared mobile navigation', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const more = page
    .getByRole('navigation', { name: 'Navegação móvel' })
    .getByRole('button', { name: 'Mais' });
  await more.click();
  const menu = page.getByRole('dialog', { name: 'Menu e preferências' });
  await menu.getByRole('link', { name: 'Cartões e faturas' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cartões e faturas' })).toBeVisible();
  await expect(menu).not.toBeVisible();
  await more.click();
  await menu.getByRole('link', { name: 'Investimentos e patrimônio' }).click();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Investimentos e patrimônio' }),
  ).toBeVisible();
});
test('new shared forms and account controls remain usable with a narrow viewport and large text', async ({
  page,
}) => {
  await signedIn(page);
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/accounts');
  await page.addStyleTag({ content: 'html { font-size: 200%; }' });
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Adicionar conta', exact: true }),
  ).toBeInViewport();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const field = dialog.getByRole('textbox', { name: 'Nome da conta', exact: true });
  await fillControl(field, 'Minha conta');
  await expectControlValue(field, 'Minha conta');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Adicionar conta', exact: true })).toBeFocused();
});

test('overview separates daily tasks from analysis and preserves the selected view across month changes', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/?month=2026-10');
  const views = page.getByRole('group', { name: 'Conteúdo da visão geral' });
  await expect(page.getByRole('region', { name: 'Saldos atuais', exact: true })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Últimos movimentos', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('region', { name: 'Evolução mensal', exact: true })).toHaveCount(0);
  await views.getByRole('button', { name: 'Análise', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Evolução mensal', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Últimos movimentos', exact: true })).toHaveCount(
    0,
  );
  await page.getByRole('button', { name: 'Mês anterior', exact: true }).click();
  await expect(page).toHaveURL(/view=analysis/);
  await expectControlValue(page.getByLabel('Mês do resumo'), '2026-09');
  await page.reload();
  await expect(views.getByRole('button', { name: 'Análise', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('button', { name: 'Ocultar valores', exact: true }).click();
  await expect(
    page.getByRole('region', { name: 'Evolução mensal', exact: true }),
  ).not.toContainText('R$');
  await views.getByRole('button', { name: 'Resumo', exact: true }).click();
  await expect(page.locator('.hero-balance')).toHaveText('••••••');
});
test('account filters explain empty results and keep account and card workspaces connected', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/accounts');
  await page
    .getByRole('group', { name: 'Tipos de contas' })
    .getByRole('button', { name: 'Benefícios', exact: true })
    .click();
  await expect(
    page.getByRole('heading', { name: 'Nenhuma conta neste filtro', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.account-record')).toHaveCount(0);
  await page
    .getByRole('group', { name: 'Tipos de contas' })
    .getByRole('button', { name: 'Todas', exact: true })
    .click();
  await expect(page.locator('.account-record')).toHaveCount(1);
  await page
    .getByRole('navigation', { name: 'Contas e cartões' })
    .getByRole('link', { name: 'Cartões e faturas', exact: true })
    .click();
  await expect(page.getByRole('heading', { level: 1, name: 'Cartões e faturas' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Contas e cartões' })
    .getByRole('link', { name: 'Contas e saldos', exact: true })
    .click();
  await expect(page.locator('.account-record')).toHaveCount(1);
});
test('directory creation is isolated from browsing, retains failed input and refreshes automation filters', async ({
  page,
}) => {
  await signedIn(page);
  let created = false;
  let fail = true;
  await page.route('**/v1/counterparties', async (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({ name: 'Mercado do bairro' });
      if (fail) return route.fulfill({ status: 500, json: { message: 'Falha temporária' } });
      created = true;
      return route.fulfill({ json: { ...automationAgent, name: 'Mercado do bairro', rules: [] } });
    }
    return route.fulfill({
      json: created ? [{ ...automationAgent, name: 'Mercado do bairro', rules: [] }] : [],
    });
  });
  await page.goto('/counterparties');
  await expect(page.getByRole('button', { name: 'Cadastrar', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Novo cadastro', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Nova pessoa ou estabelecimento' });
  await fillControl(dialog.getByLabel('Nome', { exact: true }), 'Mercado do bairro');
  await dialog.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(dialog.getByRole('alert')).toBeVisible();
  await expectControlValue(dialog.getByLabel('Nome', { exact: true }), 'Mercado do bairro');
  fail = false;
  await dialog.getByRole('button', { name: 'Cadastrar', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.counterparty-panel > summary')).toContainText('Mercado do bairro');
  await chooseSelect(page.getByLabel('Filtrar automação', { exact: true }), 'automated');
  await expect(page.getByRole('heading', { name: 'Nenhum cadastro neste filtro' })).toBeVisible();
  await chooseSelect(page.getByLabel('Filtrar automação', { exact: true }), 'manual');
  await expect(page.locator('.counterparty-panel')).toHaveCount(1);
});
test('visible date controls remove one bound without losing movement type or the other date', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/transactions?type=income&from=2026-10-01&to=2026-10-31');
  await fillControl(page.getByLabel('De', { exact: true }), '');
  const url = new URL(page.url());
  expect(url.searchParams.has('from')).toBe(false);
  expect(url.searchParams.get('to')).toBe('2026-10-31');
  expect(url.searchParams.get('type')).toBe('income');
  await expectControlValue(page.getByLabel('Até', { exact: true }), '2026-10-31');
  await expect(page.getByRole('status').filter({ hasText: '1 movimento carregado' })).toBeVisible();
});
test('settings retain the chosen section on reload and offer labelled theme previews', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/settings?view=data');
  await expect(
    page
      .getByRole('group', { name: 'Seções de preferências' })
      .getByRole('button', { name: 'Dados e backup' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page.reload();
  await expect(
    page
      .getByRole('group', { name: 'Seções de preferências' })
      .getByRole('button', { name: 'Dados e backup' }),
  ).toHaveAttribute('aria-pressed', 'true');
  await page
    .getByRole('group', { name: 'Seções de preferências' })
    .getByRole('button', { name: 'Aparência' })
    .click();
  await page.getByRole('button', { name: 'Tema claro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.getByRole('button', { name: 'Tema escuro', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
});

async function saveAccountForFeedback(page: Page, clock = false, spaces?: (typeof workspace)[]) {
  await signedIn(page);
  let current = { ...account };
  await page.route('**/v1/accounts', (route) => route.fulfill({ json: [current] }));
  await page.route(`**/v1/accounts/${account.id}`, (route) => {
    current = { ...current, ...route.request().postDataJSON(), version: current.version + 1 };
    return route.fulfill({ json: current });
  });
  if (spaces) await page.route('**/v1/workspaces', (route) => route.fulfill({ json: spaces }));
  if (clock) await page.clock.install();
  await page.goto('/accounts');
  await expect(page.locator('.account-record')).toBeVisible();
  const before = await page.locator('.account-record').boundingBox();
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar conta', exact: true });
  await fillControl(dialog.getByLabel('Nome da conta', { exact: true }), 'Minha conta');
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator('.notification-viewport').getByText('Conta salva.', { exact: true }),
  ).toBeVisible();
  const after = await page.locator('.account-record').boundingBox();
  expect(after!.y).toBe(before!.y);
}
for (const width of [390, 1440])
  test(`save feedback floats without changing page layout and remains available in the notification center at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await saveAccountForFeedback(page);
    await expect(page.locator('.accounts-page .form-success')).toHaveCount(0);
    await page
      .locator('.notification-viewport')
      .getByRole('button', { name: 'Dispensar notificação', exact: true })
      .click();
    await expect(page.locator('.notification-toast')).toHaveCount(0);
    await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
    const history = page.getByRole('dialog', { name: 'Notificações', exact: true });
    await expect(history.getByText('Conta salva.', { exact: true })).toBeVisible();
    await history.getByRole('button', { name: 'Limpar notificações', exact: true }).click();
    await expect(history.getByText('Nenhum aviso por aqui.', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('notification timeout pauses while reading and dismissed feedback remains in session history', async ({
  page,
}) => {
  await saveAccountForFeedback(page, true);
  const toast = page.locator('.notification-toast');
  await toast.hover();
  await page.clock.fastForward(12000);
  await expect(toast).toBeVisible();
  await page.getByRole('heading', { name: 'Minhas contas', exact: true }).hover();
  await page.clock.fastForward(8000);
  await expect(toast).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
  await expect(
    page.getByRole('dialog', { name: 'Notificações' }).getByText('Conta salva.', { exact: true }),
  ).toBeVisible();
});
test('notification history is cleared when switching financial spaces', async ({ page }) => {
  const other = {
    ...workspace,
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Outro',
    isDefault: false,
  };
  await saveAccountForFeedback(page, false, [workspace, other]);
  await openWorkspaceSwitcher(page);
  await page.getByRole('link', { name: 'Abrir espaço Outro', exact: true }).click();
  await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Notificações' })).not.toContainText(
    'Conta salva.',
  );
  await expect(page.getByText('Nenhum aviso por aqui.', { exact: true })).toBeVisible();
});
test('keyboard tooltips dismiss before the dialog and preserve its close action', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar conta', exact: true });
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('button', { name: 'Fechar', exact: true })).toBeFocused();
  await expect(page.getByRole('tooltip').filter({ hasText: 'Fechar' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Adicionar conta', exact: true })).toBeFocused();
});
test.describe('help on touch screens', () => {
  test.use({ hasTouch: true });
  test('financial help opens with a tap and icon actions still work with the first tap', async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto('/planning?month=2026-11');
    const help = page.getByRole('button', { name: 'Ajuda: Resultado do mês', exact: true });
    await help.tap();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toContainText('não é o saldo atual');
    const box = await tooltip.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(320);
    await page.getByRole('heading', { name: 'Planejamento mensal', exact: true }).tap();
    await expect(tooltip).toHaveCount(0);
    await page.goto('/?month=2026-10');
    await page.getByRole('button', { name: 'Mês anterior', exact: true }).tap();
    await expectControlValue(page.getByLabel('Mês do resumo'), '2026-09');
  });
});

test('an operation completing after a space switch cannot add feedback to the new space', async ({
  page,
}) => {
  await signedIn(page);
  const other = {
    ...workspace,
    id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    name: 'Outro',
    isDefault: false,
  };
  await page.route('**/v1/workspaces', (route) => route.fulfill({ json: [workspace, other] }));
  let release!: () => void;
  let started = false;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(`**/v1/accounts/${account.id}`, async (route) => {
    started = true;
    await pending;
    return route.fulfill({ json: { ...account, name: 'Minha conta', version: 2 } });
  });
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Editar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Editar conta', exact: true });
  await fillControl(dialog.getByLabel('Nome da conta', { exact: true }), 'Minha conta');
  await dialog.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await openWorkspaceSwitcher(page);
  await page.getByRole('link', { name: 'Abrir espaço Outro', exact: true }).click();
  const response = page.waitForResponse(
    (r) => r.request().method() === 'PATCH' && r.url().endsWith(`/accounts/${account.id}`),
  );
  release();
  await (await response).finished();
  await page.getByRole('button', { name: 'Abrir notificações', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Notificações' })).not.toContainText(
    'Conta salva.',
  );
});

for (const width of [390, 1440])
  test(`compact headers keep planning actions reachable without a saved-state toolbar at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/planning?month=2026-11');
    await expect(page.locator('.app-header .header-create')).toHaveCount(0);
    await expect(page.locator('.app-header .workspace-pill')).toHaveCount(0);
    await expect(page.getByText('Planejamento salvo', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('button', { name: 'Copiar mês anterior', exact: true }),
    ).not.toBeVisible();
    await page.getByRole('button', { name: 'Mais ações do planejamento', exact: true }).click();
    await chooseSelect(page.getByLabel('Contas no realizado', { exact: true }), 'cash');
    await expect(page.locator('.scope-indicator')).toHaveText('Sem benefícios');
    await page.keyboard.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Mais ações do planejamento', exact: true }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Mais ações do planejamento', exact: true }).click();
    await page.getByRole('button', { name: 'Copiar mês anterior', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Revisar cópia do mês anterior' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Mais ações do planejamento', exact: true }),
    ).toBeFocused();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
for (const example of [
  {
    now: '2024-03-15',
    previousFrom: '2024-02-01',
    previousTo: '2024-02-29',
    exclusive: '2024-03-01',
  },
  {
    now: '2026-01-15',
    previousFrom: '2025-12-01',
    previousTo: '2025-12-31',
    exclusive: '2026-01-01',
  },
])
  test(`visible period presets include the final day and retain other filters from ${example.now}`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.clock.install({ time: new Date(`${example.now}T12:00:00Z`) });
    const queries: URLSearchParams[] = [];
    await page.route('**/v1/transactions?*', (route) => {
      queries.push(new URL(route.request().url()).searchParams);
      return route.fulfill({ json: { items: [transaction], nextCursor: null } });
    });
    await page.goto('/transactions?type=expense');
    await chooseSelect(page.getByLabel('Período dos movimentos', { exact: true }), 'previous');
    await expectControlValue(page.getByLabel('De', { exact: true }), example.previousFrom);
    await expectControlValue(page.getByLabel('Até', { exact: true }), example.previousTo);
    await expect
      .poll(() =>
        queries.some(
          (q) =>
            q.get('from') === example.previousFrom &&
            q.get('to') === example.exclusive &&
            q.get('type') === 'expense',
        ),
      )
      .toBe(true);
    await chooseSelect(page.getByLabel('Período dos movimentos', { exact: true }), 'all');
    await expectControlValue(page.getByLabel('De', { exact: true }), '');
    await expectControlValue(page.getByLabel('Até', { exact: true }), '');
    expect(new URL(page.url()).searchParams.get('type')).toBe('expense');
  });
test('invalid date ranges are explained beside the visible controls without issuing an invalid query', async ({
  page,
}) => {
  await signedIn(page);
  const queries: URLSearchParams[] = [];
  await page.route('**/v1/transactions?*', (route) => {
    queries.push(new URL(route.request().url()).searchParams);
    return route.fulfill({ json: { items: [transaction], nextCursor: null } });
  });
  await page.goto('/transactions?type=income&from=2026-10-01&to=2026-10-31');
  await expect(page.getByRole('table')).toBeVisible();
  await fillControl(page.getByLabel('De', { exact: true }), '2026-11-01');
  await expect(page.getByRole('alert')).toContainText('A data inicial deve ser anterior ou igual');
  await expect(page.getByLabel('De', { exact: true })).toHaveAttribute('aria-invalid', 'true');
  expect(queries.some((q) => q.get('from') === '2026-11-01' && q.get('to') === '2026-11-01')).toBe(
    false,
  );
  await fillControl(page.getByLabel('De', { exact: true }), '2026-10-30');
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('alert')).toHaveCount(0);
});
for (const width of [390, 1440])
  test(`movement columns and detail navigation remain readable at ${width}px`, async ({ page }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.route(`**/v1/transactions/${transaction.id}`, (route) =>
      route.fulfill({ json: transaction }),
    );
    await page.goto('/transactions?from=2026-10-01&to=2026-10-31');
    const table = page.getByRole('table', { name: /Movimentos registrados/ });
    await expect(page.locator('.movements-workbench')).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    await expect(table).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    await expect(table.getByRole('columnheader')).toHaveCount(6);
    await expect(table.getByRole('row')).toHaveCount(2);
    await expect(page.getByLabel('De', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Até', { exact: true })).toBeVisible();
    await table.getByRole('button', { name: /Situação:/ }).click();
    await expect(page.getByRole('tooltip')).toContainText('Pendente de conciliação');
    await page.getByRole('tooltip').click();
    expect(new URL(page.url()).searchParams.has('transaction')).toBe(false);
    await table.getByRole('button', { name: /Compra de supermercado/ }).click();
    await expect(page.getByRole('dialog', { name: 'Detalhes do movimento' })).toBeVisible();
    await expectControlValue(
      page.getByLabel('Descrição', { exact: true }),
      transaction.description,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
test('reduced motion keeps drawers, menus and tab indicators static', async ({ page }) => {
  await signedIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/accounts');
  await page.getByRole('button', { name: 'Adicionar conta', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Adicionar conta', exact: true });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((node) => getComputedStyle(node).animationName)).toBe('none');
  await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.goto('/planning');
  const indicator = page.locator('.view-switcher-indicator').first();
  expect(await indicator.evaluate((node) => getComputedStyle(node).transitionDuration)).toBe('0s');
});

test('filter changes preserve the visible ledger while preventing reuse of the old pagination cursor', async ({
  page,
}) => {
  await signedIn(page);
  let release!: () => void;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queries: URLSearchParams[] = [];
  const income = {
    ...transaction,
    id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    description: 'Receita do mês',
    amount: 10000,
    transactionType: 'income',
  };
  await page.route('**/v1/transactions?*', async (route) => {
    const params = new URL(route.request().url()).searchParams;
    queries.push(params);
    if (params.get('type') === 'income') {
      await pending;
      return route.fulfill({ json: { items: [income], nextCursor: null } });
    }
    return route.fulfill({ json: { items: [transaction], nextCursor: 'old-filter-cursor' } });
  });
  await page.goto('/transactions');
  await expect(page.locator('.movement-table')).toContainText(transaction.description);
  await page
    .getByRole('group', { name: 'Tipos de movimentos' })
    .getByRole('button', { name: 'Receitas', exact: true })
    .click();
  await expect(page.locator('.ledger-table-area')).toHaveAttribute('inert', '');
  await expect(page.locator('.movement-table')).toContainText(transaction.description);
  await expect(
    page.getByRole('button', { name: 'Carregar mais movimentos', exact: true }),
  ).toBeDisabled();
  release();
  await expect(page.locator('.movement-table')).toContainText(income.description);
  await expect(page.locator('.ledger-table-area')).not.toHaveAttribute('inert', '');
  expect(queries.some((q) => q.get('type') === 'income' && q.has('cursor'))).toBe(false);
});

for (const width of [390, 1440]) {
  test(`styled month picker supports Portuguese labels and uncluttered planning spacing at ${width}px`, async ({
    page,
  }) => {
    await signedIn(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/planning?month=2026-11');
    const month = page.getByRole('combobox', { name: 'Mês do planejamento', exact: true });
    await expect(month).toContainText('Novembro 2026');
    await month.click();
    const popup = page.getByRole('dialog', {
      name: 'Selecionar mês: Mês do planejamento',
      exact: true,
    });
    await expect(
      popup.getByRole('button', { name: 'Novembro de 2026', exact: true }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(popup.getByRole('button', { name: 'Limpar', exact: true })).toHaveCount(0);
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('Enter');
    await expectControlValue(month, '2026-10');
    await expect(month).toBeFocused();
    const box = await page.locator('.planning-metrics').boundingBox();
    const section = await page.locator('.budget-section').first().boundingBox();
    expect(box).not.toBeNull();
    expect(section).not.toBeNull();
    expect(section!.y - (box!.y + box!.height)).toBeGreaterThanOrEqual(28);
    await expect(page.locator('.budget-section').first()).toHaveCSS(
      'background-color',
      'rgba(0, 0, 0, 0)',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('styled selects stay open inside action menus and support keyboard selection', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/planning?month=2026-11');
  const menu = page.getByRole('button', { name: 'Mais ações do planejamento', exact: true });
  await menu.click();
  const select = page.getByRole('combobox', { name: 'Contas no realizado', exact: true });
  await select.focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.getByRole('listbox')).toBeVisible();
  await expect(select).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expectControlValue(select, 'cash');
  await expect(select).toBeFocused();
  await expect(page.locator('.action-menu')).toHaveAttribute('open', '');
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
});

test('date calendar keeps localized display and ISO filters, with independent nested month selection', async ({
  page,
}) => {
  await signedIn(page);
  await page.goto('/transactions?from=2026-10-01&to=2026-10-31');
  const from = page.getByLabel('De', { exact: true });
  await expect(from).toHaveValue('01/10/2026');
  await page.getByRole('button', { name: 'Abrir calendário: De', exact: true }).click();
  const calendar = page.getByRole('dialog', { name: 'Selecionar data: De', exact: true });
  await expect(calendar).toBeVisible();
  await calendar.getByRole('combobox', { name: 'Mês do calendário', exact: true }).click();
  const months = page.getByRole('dialog', {
    name: 'Selecionar mês: Mês do calendário',
    exact: true,
  });
  await months.getByRole('button', { name: 'Setembro de 2026', exact: true }).click();
  await expect(months).toBeHidden();
  await expect(calendar).toBeVisible();
  await calendar.locator('[data-date="2026-09-15"]').click();
  await expect(calendar).toBeHidden();
  await expect(from).toHaveValue('15/09/2026');
  await expectControlValue(from, '2026-09-15');
  await expect(page).toHaveURL(/from=2026-09-15/);
  await expect(from).toBeFocused();
});

test('invalid typed dates prevent a financial form from saving the previous date', async ({
  page,
}) => {
  await signedIn(page);
  let writes = 0;
  await page.route('**/v1/transactions', async (route) => {
    if (route.request().method() === 'POST') writes++;
    return route.fulfill({ json: transaction });
  });
  await page.goto('/transactions?new=1');
  const form = page.getByRole('dialog');
  await form.getByLabel('Descrição', { exact: true }).fill('Teste de data');
  await form.getByLabel('Valor (R$)', { exact: true }).fill('10,00');
  const date = form.getByLabel('Data', { exact: true });
  await date.fill('31/02/2026');
  await date.press('Tab');
  await expect(date).toHaveAttribute('aria-invalid', 'true');
  await form.getByRole('button', { name: 'Registrar movimento', exact: true }).click();
  expect(writes).toBe(0);
  await expect(form).toBeVisible();
  await expect(date).toBeFocused();
});

test('app entry fades once per tab and keeps reduced motion static', async ({ page }) => {
  await signedIn(page);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('.app-shell')).toHaveCSS('animation-name', 'none');
  await expect
    .poll(() => page.evaluate(() => sessionStorage.getItem('mywallet:entered')))
    .toBe('yes');
  await page.reload();
  await expect(page.locator('.app-shell')).not.toHaveClass(/app-entry/);
  const announcer = page.locator('.sr-only').first();
  await expect(announcer).toHaveCSS('position', 'absolute');
  await expect(announcer).toHaveCSS('width', '1px');
});
