# MyWallet

**Seu dinheiro, com clareza.**

Aplicação de finanças pessoais com visual inspirado em fintechs, espaços independentes e importação manual de extratos. Uma PWA responsiva para acessar pelo navegador ou instalar em dispositivos compatíveis, com temas claro, escuro e automático.

O projeto está em fase de **piloto**. O dashboard mostra os saldos das contas cadastradas e as movimentações do período; a visão completa de patrimônio e investimentos faz parte da evolução do produto.

## Funcionalidades

- **Espaços financeiros:** seleção em cards, criação com nome, descrição e cor, e dados separados por espaço.
- **Contas:** instituições, saldo inicial com data de referência e acompanhamento do saldo registrado.
- **Movimentações:** receitas, despesas, categorias, filtros, correções e estornos.
- **Transferências:** lançamento das duas movimentações entre contas na mesma transação.
- **Extratos:** importação de PDF do Mercado Pago, conferência de saldos, revisão, identificação de possíveis duplicidades e confirmação com proteção contra repetição.
- **Dados:** exportação em CSV, backup financeiro em JSON e restauração com prévia de impacto.
- **Acesso:** cadastro, login e recuperação de senha pelo Supabase Auth.
- **Interface:** navegação adaptada a desktop e celular, alternância de tema e instalação como PWA.

Cada usuário acessa seus próprios espaços. Compartilhamento, convites e membros ainda não estão implementados. Operações financeiras exigem conexão; o service worker armazena os arquivos estáticos da interface.

## Tecnologias

| Camada             | Tecnologias                                                   |
| ------------------ | ------------------------------------------------------------- |
| Frontend           | React 19, TypeScript, Vite, TanStack Query, Radix UI e Lucide |
| Backend            | NestJS 12, PostgreSQL e `pg`                                  |
| Identidade e banco | Supabase Auth e Supabase PostgreSQL                           |
| Importação         | PDF.js e mapeador específico por instituição                  |
| Qualidade          | Vitest, PGlite, Playwright, Oxlint e Prettier                 |
| Execução           | Node.js 24, npm workspaces e Docker                           |

## Executar localmente

### 1. Instalar dependências

Requisitos: Node.js **24.21.0**, npm e um projeto Supabase com acesso ao PostgreSQL.

```bash
git clone https://github.com/BrenoSerenMartins/MyWallet.git
cd MyWallet
nvm use
npm ci
```

O comando `nvm use` é opcional se a versão indicada em `.nvmrc` já estiver instalada e ativa.

### 2. Configurar o ambiente

Na primeira instalação, copie o modelo:

```bash
cp .env.example .env.local
```

Se você já possui `.env.local`, preserve esse arquivo. Preencha os valores conforme o seu projeto Supabase:

| Variável                   | Uso                                                                                    |
| -------------------------- | -------------------------------------------------------------------------------------- |
| `SUPABASE_URL`             | URL pública do projeto                                                                 |
| `SUPABASE_PUBLISHABLE_KEY` | Chave pública usada na autenticação                                                    |
| `SUPABASE_PROJECT_REF`     | Identificador do projeto                                                               |
| `DATABASE_URL`             | Conexão administrativa PostgreSQL completa, incluindo a senha, para setup e migrations |
| `SUPABASE_DB_PASSWORD`     | Senha administrativa usada quando existe uma conexão de pooler salva pelo Supabase CLI |
| `RUNTIME_DATABASE_URL`     | Conexão restrita da API, preenchida pelo setup; preserve-a após a primeira execução    |
| `DATABASE_CA_FILE`         | Opcional: caminho para uma CA confiável diferente da incluída no projeto               |
| `PORT`                     | Porta da API; padrão `8083`                                                            |

As credenciais administrativas ficam no ambiente de setup. O navegador recebe apenas a URL e a chave pública de autenticação.

### 3. Preparar o banco

```bash
npm run db:setup
```

O setup aplica as migrations pendentes, provisiona a credencial restrita `mywallet_runtime`, verifica a conexão com TLS e salva a configuração local da API. O certificado público da CA do Supabase está em `infra/certificates/`; a validação TLS permanece ativada.

Para aplicar somente migrations em um ambiente já configurado:

```bash
npm run db:migrate
```

O histórico fica em `mywallet_migrations.applied`. Use esses comandos para aplicar o SQL de `supabase/migrations/`; não combine esse histórico com `supabase db push`.

### 4. Configurar a autenticação

No Supabase, em **Authentication → URL Configuration**, permita os redirects:

```text
http://localhost:5173/auth/callback
http://localhost:5173/reset-password
```

Ajuste as URLs para a porta ou o domínio utilizados e configure o Site URL correspondente. O primeiro usuário é criado pela tela de cadastro.

### 5. Iniciar o desenvolvimento

```bash
npm run dev
```

| Serviço             | Endereço padrão            |
| ------------------- | -------------------------- |
| Aplicação           | http://localhost:5173      |
| API                 | http://localhost:8083      |
| Documentação da API | http://localhost:8083/docs |

O Vite encaminha as chamadas de API para a porta `8083`. Se essa porta estiver ocupada, encerre a instância anterior antes de iniciar outra. Caso o Vite escolha outra porta para o frontend, atualize os redirects de autenticação.

## Build e execução em produção

Com as dependências instaladas e `.env.local` configurado:

```bash
npm run deploy
```

O script confere a disponibilidade da porta, valida o código, executa os testes, gera os builds, prepara o banco com TLS e inicia a API servindo também o frontend. Ele interrompe a execução se uma etapa falhar.

| Comando                                   | Resultado                                                     |
| ----------------------------------------- | ------------------------------------------------------------- |
| `npm run deploy -- --prepare-only`        | Valida, gera o build e prepara o banco sem iniciar o servidor |
| `npm run deploy -- --port=8084`           | Executa o fluxo e inicia na porta `8084`                      |
| `NODE_ENV=production npm start`           | Inicia o build existente na porta configurada                 |
| `PORT=8084 NODE_ENV=production npm start` | Inicia o build existente na porta `8084`                      |

Esses exemplos usam um terminal Bash. O servidor roda em primeiro plano e pode ser encerrado com Ctrl+C. O script depende de acesso ao Supabase; erros de DNS como `EAI_AGAIN` interrompem a etapa de banco.

Para disponibilizar publicamente, configure hospedagem, HTTPS, redirects de autenticação e supervisão do processo. O comando de deploy prepara e executa a aplicação na máquina atual. O TLS do banco é independente do HTTPS do site; a instalação da PWA em um domínio público requer HTTPS.

### Docker

Depois de preparar o banco:

```bash
docker compose --env-file .env.local up --build -d
```

Acesse http://localhost:8083. Para usar outra porta no host:

```bash
MYWALLET_PORT=8084 docker compose --env-file .env.local up --build -d
```

O container recebe as credenciais restritas da API. O arquivo `render.yaml` oferece um modelo de hospedagem no Render.

## Arquitetura

```text
app/src/
  app/                  Rotas, providers, shell e estilos
  features/             Telas, componentes e hooks por funcionalidade
  shared/               Transporte HTTP, contratos, UI e formatação
api/src/
  core/                 Autenticação, configuração e transações com escopo
  modules/              Controllers, serviços e repositórios por domínio
  composition/          Integração explícita entre módulos
supabase/migrations/    Fonte única das alterações de banco
infra/certificates/     Certificado público para validação TLS
scripts/                Desenvolvimento, banco, deploy e verificações
knowledge/              Decisões, regras de domínio e mapas técnicos
```

Controllers validam a entrada e chamam serviços. Serviços concentram as regras financeiras; repositórios executam SQL parametrizado. As integrações entre módulos passam por contratos explícitos.

A API valida o usuário e o espaço selecionado. RLS e chaves compostas no PostgreSQL protegem o isolamento dos dados. Ao trocar de espaço, o frontend substitui o cache financeiro e reinicia as telas. Valores monetários são armazenados em centavos inteiros, com suporte inicial a BRL.

## Verificação e manutenção

| Comando                   | Finalidade                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `npm run verify`          | Lint, tipos, limites entre módulos, testes, builds e verificação de credenciais no frontend |
| `npm run format:check`    | Conferir formatação do código                                                               |
| `npm run contracts`       | Gerar OpenAPI e tipos de transporte do frontend                                             |
| `npm run contracts:check` | Verificar se os contratos gerados estão atualizados                                         |
| `npm run test:e2e`        | Executar testes de interface com Playwright                                                 |
| `npm run db:cleanup`      | Remover conteúdo de rascunhos de importação e restauração expirados                         |

Para os testes de navegador, instale o Chromium:

```bash
npx playwright install chromium
npm run test:e2e
```

Os testes de banco usam PostgreSQL via PGlite. Os testes de interface usam autenticação e respostas sintéticas; a validação com Supabase real, e-mails e instalação em dispositivos deve ser feita no ambiente de destino.

`GET /health` verifica o processo. `GET /ready` verifica a conexão e a identidade restrita de banco. A documentação OpenAPI em produção é habilitada com `DOCS_ENABLED=true`.

## Extratos, backups e privacidade

O importador atual interpreta PDFs de extrato de conta do Mercado Pago. Outros bancos exigem seus próprios parsers e mapeadores para o modelo financeiro comum. Cada importação deve ser revisada antes da confirmação.

O PDF original não é armazenado. O histórico conserva o nome e o hash do arquivo, além da origem dos lançamentos. Rascunhos expiram após 24 horas e podem ser removidos com `db:cleanup`.

O backup JSON cobre o espaço selecionado: contas, categorias e movimentações financeiras ativas. Ele não inclui PDFs, rascunhos nem todo o histórico de auditoria. CSV serve para análise; a restauração usa JSON. Para recuperação completa do histórico, mantenha também backups operacionais do PostgreSQL.

Guarde extratos e exportações locais em `statements/`, `backups/` ou `.local-data/`, diretórios ignorados pelo Git. O `.gitignore` também exclui arquivos de ambiente, chaves privadas, formatos de extrato, dependências, builds e relatórios locais.

## Evolução do produto

Investimentos, patrimônio consolidado, reserva de emergência, metas, cartões, compartilhamento de espaços e sincronização offline ainda estão fora do piloto implementado. O escopo e os critérios de entrega estão na base de conhecimento:

- [Visão da arquitetura](knowledge/architecture/overview.md)
- [Escopo e regras financeiras](knowledge/domains/personal-finance.md)
- [Plano do piloto](knowledge/architecture/pilot-plan.md)
- [Design system](knowledge/architecture/design-system.md)
- [Importação de extratos](knowledge/architecture/statement-imports.md)
- [Mapa de rotas](knowledge/maps/routes.md)
- [Modelo de banco](knowledge/maps/database.md)
