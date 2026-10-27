# MyWallet

**Seu dinheiro, com clareza.**

Aplicação de finanças pessoais com visual inspirado em fintechs, espaços independentes e importação manual de extratos. Uma PWA responsiva para acessar pelo navegador ou instalar em dispositivos compatíveis, com temas claro, escuro e automático.

O projeto está em fase de **piloto**. O dashboard mostra os saldos das contas cadastradas e as movimentações do período; a visão completa de patrimônio e investimentos faz parte da evolução do produto.

## Funcionalidades

- **Espaços financeiros:** seleção em cards, criação com nome, descrição e cor, e dados separados por espaço.
- **Contas:** cadastro simples por instituição e tipo, importação de histórico e acompanhamento do saldo registrado.
- **Planejamento mensal:** receitas/despesas previstas por categoria, cards com previsto, realizado e diferença; lançamentos sem categoria incluídos em Outros, intenção de aporte, notas e cópia revisada do mês anterior.
- **Grupos e categorias:** organize Casa → Luz/Água e Alimentação → Mercado/Comer fora; abas de grupos com Geral primeiro, lista compacta de categorias, busca, edição e exclusão revisada. O grupo padrão Geral recebe categorias ainda não organizadas.
- **Agentes e regras:** pessoas e estabelecimentos com nomes/descrições e IDs de loja por origem; categorias automáticas para histórico e próximos movimentos, preservando escolhas manuais.
- **Movimentações:** receitas, despesas, categorias agrupadas, filtros recolhíveis, abas por tipo, correções e estornos.
- **Transferências:** lançamento das duas movimentações entre contas na mesma transação.
- **Extratos:** importação de extratos de conta do Mercado Pago em PDF, CSV e XLSX, classificação automática de entradas/saídas, conferência de saldos, revisão, exclusão automática e bloqueio de duplicatas identificadas, revisão em abas e confirmação com proteção contra repetição.
- **Histórico de extratos:** salve movimentos antigos apenas para consulta e busque dentro do extrato sem alterar saldos ou gastos. Integração financeira posterior exige revisão e conciliação.
- **Dados:** exportação em CSV, backup financeiro em JSON com planejamentos e restauração com prévia de impacto.
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

### Hospedagem recomendada: Render

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/BrenoSerenMartins/MyWallet)

O Blueprint `render.yaml` configura um único serviço Docker na branch `main`, com frontend e API no mesmo domínio, plano gratuito, porta interna `10000` e health check em `/ready`. Não é necessário criar outro banco: os dados continuam no Supabase.

1. Abra o botão acima ou, no Render, escolha **New → Blueprint**, conecte o GitHub e selecione este repositório. Para repositórios privados, permita acesso ao app do Render no GitHub.
2. Confira o serviço `mywallet-pilot` e forneça `SUPABASE_PUBLISHABLE_KEY` e `RUNTIME_DATABASE_URL` a partir do seu `.env.local`. `SUPABASE_URL` já está definida no Blueprint para o projeto atual.
3. Use uma conexão restrita `mywallet_runtime` compatível com o host. O Session pooler do Supabase oferece IPv4; se a configuração atual já usa esse pooler, mantenha o valor. Não substitua a credencial restrita pela conexão administrativa `postgres`.
4. Antes de publicar uma versão com alterações de banco, execute `npm run db:setup` no terminal local com conectividade. O container não aplica migrations automaticamente nem precisa receber a senha administrativa.
5. Inicie o deploy pelo painel. O Render usa o Dockerfile para construir e executar o serviço; não configure `npx wrangler deploy` ou `npm run deploy` como comando desse serviço Docker.
6. Quando a URL HTTPS estiver disponível, configure-a como Site URL no Supabase Auth e permita `/auth/callback` e `/reset-password` nesse domínio. Confira `/ready`, faça login e valide leitura/escrita no seu espaço.

Em um serviço já criado, confira **Environment → PORT = 10000** e **Settings → Health Check Path = /ready**. Se o Blueprint não sincronizar automaticamente, sincronize-o no painel ou atualize essa variável antes do novo deploy. O log de inicialização informa a porta efetivamente usada. Desenvolvimento e Docker Compose local continuam usando `8083`.

O plano gratuito pode adormecer após inatividade; a primeira abertura pode demorar. O worker separado do Cloudflare não é necessário nesse caminho. Se houver um deploy frontend antigo, utilize a URL do Render para acessar a aplicação completa.

#### Diagnosticar deploy que inicia, mas não fica saudável

O log `HTTP listening on 0.0.0.0:10000` confirma a porta HTTP no Render; a liberação do deploy também depende de `/ready`, que verifica o PostgreSQL e o papel restrito. Se essa etapa falhar, procure `Database readiness failed:` nos logs. O app registra somente códigos permitidos, sem mensagens brutas, URLs ou senhas, e evita repetir a mesma falha em cada probe.

| Código                                                          | O que conferir                                                                                               |
| --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `RUNTIME_DATABASE_URL_MISSING`                                  | A variável deve conter a conexão restrita completa, sem o prefixo `RUNTIME_DATABASE_URL=` no valor do painel |
| `RUNTIME_ROLE_INVALID`                                          | Use a credencial `mywallet_runtime`, não a administrativa `postgres`                                         |
| `28P01` / `28000`                                               | Usuário/senha e sufixo do projeto no usuário do pooler; copie a conexão restrita gerada pelo setup           |
| `ENETUNREACH` / `EHOSTUNREACH`                                  | Compatibilidade de rede; confira a conexão de Session pooler IPv4                                            |
| `ENOTFOUND` / `EAI_AGAIN`                                       | Host da conexão e resolução DNS                                                                              |
| `SELF_SIGNED_CERT_IN_CHAIN` / `UNABLE_TO_VERIFY_LEAF_SIGNATURE` | CA usada e parâmetros SSL da conexão; mantenha a verificação TLS ativada                                     |
| `TIMEOUT` / `ETIMEDOUT`                                         | Conectividade, restrições de rede, disponibilidade e capacidade do banco/pooler                              |
| `CONNECTION_FAILED`                                             | Falha não classificada; verifique os eventos do provedor e a configuração sem publicar credenciais           |

A recuperação registra `Database readiness: READY.`. O corpo público de `/ready` mantém apenas o estado geral. Envie o código do diagnóstico para investigar uma falha, sem colar a URL PostgreSQL ou senhas. Aumentar o prazo do deploy não corrige uma conexão inválida.

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

### Frontend no Cloudflare Workers

O arquivo `wrangler.jsonc` na raiz define o frontend em `app/dist` e o tratamento das rotas da SPA. Configure o projeto no painel do Cloudflare:

| Configuração       | Valor                                       |
| ------------------ | ------------------------------------------- |
| Diretório raiz     | Raiz do repositório                         |
| Build command      | `npm run build:cloudflare`                  |
| Deploy command     | `npm run deploy:cloudflare`                 |
| Versão do Node     | `24.21.0`                                   |
| Variáveis de build | `SUPABASE_URL` e `SUPABASE_PUBLISHABLE_KEY` |

Ajuste `name` em `wrangler.jsonc` se o nome do Worker criado no painel for diferente de `mywallet`. Com as dependências instaladas, `npm run check:cloudflare` valida o empacotamento sem publicar. O comando local `npm run deploy` continua destinado ao servidor Node e não deve ser usado como deploy command do Cloudflare.

Essa configuração publica a interface. A API Nest permanece um serviço Node separado; para o app financeiro funcionar nesse domínio, ainda é necessário hospedar a API e encaminhar `/v1` para ela. O proxy do Vite existe somente no desenvolvimento. Configure também os redirects do Supabase Auth para o domínio publicado. Credenciais PostgreSQL não são necessárias no build do frontend.

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

O importador atual interpreta extratos de conta do Mercado Pago em PDF com texto, CSV UTF-8 e XLSX com uma única aba. CSV/XLSX devem conter o resumo de saldos e a tabela de movimentos do modelo de extrato de conta; faturas de cartão, XLS e outros layouts ainda não são aceitos. Os extratos de conta conciliam saldos; CSV/XLSX também conferem os totais de créditos/débitos. Os limites são 10 MB por arquivo, 100 páginas no PDF e 10.000 movimentos. Outros bancos exigem seus próprios parsers e mapeadores para o modelo financeiro comum. Cada importação deve ser revisada antes da confirmação. Você pode selecionar vários arquivos de uma vez para a mesma conta. O app processa um por vez e mostra sucessos e erros individualmente; ao terminar, abra a revisão de cada extrato. Mantenha a tela aberta enquanto a fila é processada. A opção de parar conclui o arquivo em andamento e deixa os próximos sem enviar; extratos já processados continuam no histórico.

Ao excluir um grupo, a prévia mostra quantas categorias irão para o grupo padrão. A exclusão preserva seus lançamentos e planejamentos; nomes repetidos no destino precisam ser resolvidos antes. O grupo padrão é protegido, existe por tipo em cada espaço e também recebe categorias vindas de backups antigos. A migration `202610230005_default_category_groups.sql` deve ser aplicada com `npm run db:setup` antes de publicar esta versão.

A seção Despesas ou Receitas define automaticamente o tipo dos novos grupos e categorias. Indicadores da seção acompanham vermelho ou verde, mantendo a identidade visual nas ações. Grupos e categorias novos começam em vermelho para despesas e verde para receitas. Grupos podem ter cor personalizada e **Restaurar cor padrão**; categorias seguem a cor do tipo. As alterações só são gravadas ao salvar. Você pode excluir categorias: elas saem das novas escolhas, preservando seus lançamentos e planejamentos anteriores.

Use **Reprocessar importação** em um rascunho ou histórico para atualizar a análise dos dados salvos ou reler o mesmo arquivo original. O app preserva as escolhas e permite refazer explicitamente os tipos financeiros. A ação não confirma movimentos nem altera lançamentos já confirmados. Movimentos reconhecidos de cofrinhos continuam como transferências; o saldo individual de cada cofrinho ainda não é montado automaticamente.

Entradas são classificadas automaticamente como receitas e saídas como despesas, mantendo reservas reconhecidas como transferências. Você pode corrigir os tipos e escolher categorias antes de confirmar. Rascunhos antigos também recebem esses padrões sem reenviar o arquivo. Extratos anteriores precisam ser confirmados para compor o saldo: se um mês ainda estiver em revisão ou apenas como histórico, o app orienta a concluí-lo e mantém a abertura da conta.

Na revisão, duplicatas identificadas pela referência, data, valor e saldo de origem ficam bloqueadas e são revalidadas antes da confirmação, inclusive entre arquivos enviados antes de confirmar. Coincidências sem origem suficiente aparecem em pendências para conferência; descrições e valores iguais podem representar gastos legítimos. Editar um lançamento importado preserva a identificação do movimento bancário original; estorná-lo permite reimportar.

O fluxo de importação usa **extratos de conta**, não relatórios EDI. Mercado Pago aceita extratos em PDF, CSV e XLSX; Alelo Alimentação aceita o PDF do Meu Alelo. Arquivos EDI novos são recusados com orientação para usar o extrato. EDIs antigos e seus lançamentos são preservados para consulta e desfazimento; não podem criar nem conciliar novos movimentos pela API pública. Extratos confirmados fornecem a evidência dos movimentos sem depender de outro arquivo; isso não comprova que todo o histórico ou saldo bancário esteja completo.

O arquivo original (PDF, CSV ou XLSX) não é armazenado. O histórico conserva o nome e o hash do arquivo, além da origem dos lançamentos. Rascunhos expiram após 24 horas e podem ser removidos com `db:cleanup`. Extratos já salvos como histórico de consulta ficam protegidos dessa limpeza, inclusive se forem reabertos para uma revisão financeira.

O backup JSON versão 4 cobre o espaço selecionado: contas, grupos, categorias, movimentações financeiras ativas e planejamentos mensais. Ele preserva também a identidade de origem das operações para evitar duplicatas após restauração. Backups versões 1, 2 e 3 continuam aceitos; categorias desses arquivos permanecem sem grupo. Meses de planejamento já existentes impedem a restauração inteira para preservar os dois conjuntos; use outro espaço para restaurar nesse caso. Ele não inclui PDFs, rascunhos, extratos salvos apenas para consulta nem todo o histórico de auditoria. CSV serve para análise; a restauração usa JSON. Para recuperação completa do histórico, mantenha também backups operacionais do PostgreSQL.

Guarde extratos e exportações locais em `statements/`, `backups/` ou `.local-data/`, diretórios ignorados pelo Git. O `.gitignore` também exclui arquivos de ambiente, chaves privadas, formatos de extrato, dependências, builds e relatórios locais.

## Evolução do produto

Investimentos, patrimônio consolidado, reserva de emergência, metas, cartões, compartilhamento de espaços e sincronização offline ainda estão fora do piloto implementado. O planejamento mensal compara os lançamentos já registrados; não gera cobranças recorrentes nem identifica automaticamente aportes realizados. O escopo e os critérios de entrega estão na base de conhecimento:

- [Visão da arquitetura](knowledge/architecture/overview.md)
- [Escopo e regras financeiras](knowledge/domains/personal-finance.md)
- [Plano do piloto](knowledge/architecture/pilot-plan.md)
- [Design system](knowledge/architecture/design-system.md)
- [Importação de extratos](knowledge/architecture/statement-imports.md)
- [Mapa de rotas](knowledge/maps/routes.md)
- [Modelo de banco](knowledge/maps/database.md)

Em **Movimentações**, o filtro de conciliação separa pendentes e conciliadas. Nos detalhes, confira o ID externo e os relatórios vinculados. Para recuperar campos antes descartados em extratos antigos, reprocese com o arquivo original; relatórios guardados no histórico podem voltar à revisão e ser confirmados financeiramente.

Para investigar uma diferença de saldo sem alterar dados, execute `npm run db:diagnose -- --balance=703.31` (valor exibido no app, com ponto decimal) ou `npm run db:diagnose -- --account=<uuid>`. O comando usa `.env.local`, verifica TLS e imprime valores em centavos, posição inicial, movimentos manuais/importados e diferenças para os últimos extratos confirmados. Ele não corrige saldos automaticamente.

### Alelo e saldo atual

Cadastre a instituição **Alelo** com o tipo **Vale-alimentação** ou **Vale-refeição**, separando os saldos. O importador validado aceita o PDF com texto de **Alelo Alimentação** do Meu Alelo. Ele importa créditos e compras, mantém compras iguais como ocorrências distintas e exige revisão de arquivos sobrepostos. O PDF não informa saldo inicial nem saldos por movimento: a cobertura de saldo é parcial, mas os movimentos confirmados ficam conferidos pelo próprio arquivo. Não é preciso fornecer data nem saldo inicial. Refeição ainda precisa de um modelo compatível para importação.

A visão geral separa dinheiro disponível, benefícios e reservas registradas. Entradas/saídas mensais incluem todas as contas; em Planejamento, o filtro permite ver o realizado com ou sem benefícios, sem alterar o plano salvo.

Em **Minhas contas → Corrigir saldo**, informe o saldo atual correto e o motivo. O app mostra a diferença e registra uma **Correção de saldo manual**, preservando os movimentos anteriores. O ajuste não entra em receitas/despesas e não marca a conta como conciliada. Ele pode ser desfeito pelo histórico; seu registro e motivo ficam no backup. Se houver lançamentos futuros ou o saldo mudar durante a confirmação, revise antes de tentar novamente. Não some o saldo atual ao saldo de abertura: a correção calcula apenas a diferença.

As migrations `202610260002_alelo_benefit_imports.sql` e `202610260003_manual_balance_adjustments.sql` foram aplicadas pelo usuário antes do deploy.

### Histórico sem configuração inicial e devoluções

O cadastro de contas pede nome, instituição e tipo. A API também aceita criar/editar sem data ou saldo inicial. Importações podem ter qualquer data válida, em qualquer ordem. Confirmar um extrato registra os movimentos selecionados sem copiar o saldo inicial do arquivo para a conta nem mudar uma data de início.

Saldos fornecidos pelo banco são dados opcionais para conferência, dentro dos detalhes do arquivo. Modelos sem esses dados, como Alelo, também funcionam. O saldo exibido usa os movimentos registrados e preserva valores legados já existentes nas contas. Para alinhar um histórico parcial a um saldo atual conhecido, use **Corrigir saldo**; o ajuste fica documentado sem inventar gastos ou receitas.

Devoluções vinculadas mantêm o controle da compra/receita original e a categoria. Vínculos e fatos bancários legados continuam preservados nos backups; retirar o EDI do envio não apaga lançamentos financeiros.

### Pessoas, estabelecimentos e reconhecimento de descrições

Em **Pessoas e estabelecimentos**, mantenha um cadastro para cada pessoa ou empresa e vincule várias descrições de origem. **Adicionar descrição de reconhecimento** relaciona uma nova descrição ao histórico e aos próximos movimentos da conta sem exigir categoria. Regras de categoria continuam separadas por conta e tipo (receita/despesa); escolhas manuais, valores, datas e conciliação são preservados.

Descrições já vinculadas são reconhecidas mesmo com diferenças de acento, pontuação, maiúsculas e espaços. Mudanças de Pix para cartão, nomes abreviados e pequenas diferenças de escrita podem gerar **Possível pessoa ou estabelecimento**. O app mostra até três opções para você conferir; semelhança nunca cria um vínculo automaticamente. Nomes ambíguos ou genéricos e IDs de operações não comprovam identidade.

Ao selecionar **Vincular … e reconhecer esta descrição**, salve o lançamento ou a revisão e confirme o extrato para gravar a relação. Na revisão, nada é aprendido antes da confirmação financeira. A opção de reconhecer a descrição é independente de **Usar esta categoria para esta pessoa ou estabelecimento neste tipo de movimento**. Assim, a mesma pessoa pode aparecer em receitas e despesas sem impor a mesma categoria.

Cadastros/regras podem ser desativados e descrições removidas sem apagar histórico. Relações antigas de EDI/loja ficam preservadas por compatibilidade. O backup JSON v5 mantém os vínculos, inclusive ambiguidades antigas que o reconhecimento não pode decidir sozinho. Esta melhoria não exige migration extra.

As migrations `202610260005_counterparty_rules.sql` e `202610260006_counterparty_external_identifiers.sql` criam os vínculos protegidos por espaço. O backup financeiro JSON v5 preserva agentes, identificações ativas/desativadas, regras e a origem da classificação, com remapeamento de IDs na restauração; backups v1–v4 continuam aceitos.
