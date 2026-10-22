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
    await expect(page.getByRole('button', { name: 'Selecionar PDF' })).toBeEnabled();
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
