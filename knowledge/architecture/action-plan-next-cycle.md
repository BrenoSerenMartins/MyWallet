# Plano de ação — próximo ciclo do PlannedWallet

Estado: plano para execução; não comprova implementação das etapas abaixo.
Data: 2026-11-05.

## Objetivo e escopo

Consolidar o piloto e entregar metas/reservas, alertas persistentes, revisão assistida de reconhecimento e espaços compartilhados. Preservar os dados existentes e a interface aberta, com números em destaque, ações discretas e títulos visíveis nas páginas dentro de Mais.

A base atual já inclui compromissos, faturas, investimentos manuais, patrimônio, correção de saldo, importação de Mercado Pago/Alelo e regras de agentes. O reconhecimento já oferece candidatos por nome, abreviação e semelhança: o trabalho novo amplia a revisão e a explicação das sugestões.

Não fazem parte deste ciclo: novos bancos, Open Finance, sincronização financeira offline, cotações automáticas e cobrança de assinatura. Esses itens precisam de planejamento próprio.

## Complemento: saldo disponível e virada do mês

O [plano de saldo trazido, benefícios e reservas](monthly-carryover-plan.md) detalha a continuidade entre meses e a competência única em resumo, gráficos e filtros. Executar sua especificação financeira e cálculo histórico antes de concluir metas/reservas; estabilização e evidência de CI continuam como pré-requisito. Esse complemento é planejamento, não implementação.

## Ordem e dependências

1. Estabilização e inventário técnico.
2. Consolidação da interface e documentação.
3. Metas e reservas.
4. Alertas persistentes.
5. Reconhecimento assistido.
6. Compartilhamento de espaços.
7. Validação integrada e beta fechado.

Na etapa 1, definir também a arquitetura de permissões da etapa 6. Os módulos novos devem nascer com `workspace_id`, autoria explícita e contratos de autorização compatíveis com membros, evitando repetir o acoplamento entre proprietário do registro e usuário que executa a operação.

Cada etapa entrega banco, API, interface, documentação e verificações correspondentes. Recursos incompletos ficam indisponíveis ao usuário até cumprirem seu critério de conclusão.

## 1. Estabilizar o que existe

### Trabalho

- Inventariar funcionalidades reais, migrations, endpoints, testes e documentação desatualizada.
- Atualizar os testes de navegador para os controles e layouts atuais antes de usá-los como evidência de regressão.
- Preparar execução de Playwright em ambiente que permita servidor local e Chromium; usar dados sintéticos, sem extratos pessoais no repositório.
- Testar o ciclo financeiro: importação, revisão, confirmação, repetição da confirmação, duplicatas, reprocessamento, estorno e reversão.
- Conferir referência de saldo do Mercado Pago com lacunas, sobreposição e ordem diferente de importação; preservar a correção manual da Alelo.
- Conferir crédito de benefício no mês seguinte, virada de ano, transferências, devoluções, faturas, pagamentos e posições patrimoniais.
- Fazer exportação e restauração de um conjunto sintético com todos os módulos; verificar referências e totais antes/depois e ampliar o formato versionado se houver lacunas.
- Revisar sessão expirada, ausência de conexão, conflitos de versão e repetição de operações.
- Registrar baseline: banco sintético restaurável, verificações que passaram e limitações ainda abertas.

### Critério de conclusão

`npm run verify` e contratos passando; fluxos críticos de navegador executados com sucesso; restauração demonstrada; divergências financeiras bloqueantes resolvidas. Compilar ou listar testes não conta como executar testes visuais.

## 2. Consolidar interface e documentação

### Trabalho

- Inventariar a cascata de CSS, remover regras antigas e overrides que já foram substituídos; migrar por componente, sem uma reescrita cega.
- Consolidar tokens de altura, espaçamento, tipografia e divisórias; componentes de ação discreta, cabeçalho contextual e expansão.
- Revisar conteúdo fechado e aberto, formulários, modais, tabelas com rolagem local, menus, estados vazios e erros em todas as rotas.
- Validar 320, 390, 768 e 1440 px, temas claro/escuro, teclado, zoom, textos longos, valores altos e movimento reduzido.
- Conferir navegação inferior com área segura, rolagem e teclado virtual em um aparelho real; eliminar regras e remendos redundantes após comprovar a correção.
- Atualizar README, mapas de rotas/banco e documentos de arquitetura para refletirem o código atual.
- Medir o carregamento e a navegação; corrigir gargalos comprovados, sem adicionar animações ou dependências por estética.

### Critério de conclusão

Sem corte de valores, controles sobrepostos ou rolagem horizontal da página nos cenários verificados; foco e ações acessíveis; estados expandidos consistentes; evidências visuais registradas. Os cálculos financeiros permanecem iguais.

## 3. Metas e reservas

### Produto

- Área Metas, acessível inicialmente pelo menu Mais.
- Criar, editar, concluir e arquivar metas com nome, valor alvo, prazo opcional e prioridade.
- Mostrar valor reservado, restante, progresso e ritmo mensal necessário quando houver prazo.
- Vincular valores às contas de dinheiro/reserva elegíveis; benefícios ficam fora.
- Distinguir intenção de poupar de dinheiro efetivamente reservado.
- Registrar e desfazer alocações com histórico e proteção contra repetição; movimentar dinheiro entre contas continua sendo transferência.

### Modelo e integração

- Tabelas de metas e alocações com valores em unidades menores, `workspace_id`, autoria, versão e referências compostas.
- Impedir dupla alocação do mesmo saldo e valores negativos; definir o tratamento quando uma conta perde saldo após uma importação ou correção.
- Se a cobertura cair, sinalizar insuficiência sem alterar silenciosamente a meta ou criar lançamentos compensatórios.
- A alocação é uma destinação do saldo: não cria receita/despesa nem duplica a dedução de reservas no saldo disponível ou no patrimônio.
- Planejamento mostra a intenção de aporte e sua associação com metas; não classificar toda transferência como aporte automaticamente.
- Incluir metas/alocações no backup, restauração e exclusão do espaço.

### Critério de conclusão

Criar, reservar, transferir, desfazer e arquivar sem alterar indevidamente receitas, despesas ou patrimônio. Testar concorrência, saldo insuficiente, reversões e restauração.

## 4. Alertas persistentes

### Produto

- Unificar avisos persistentes com a central existente, preservando toasts para retorno imediato das ações.
- Alertas de vencimento próximo, atraso, orçamento próximo do limite/ultrapassado e metas que precisam de atenção.
- Preferências por usuário/espaço: tipos ativos, antecedência e limites; leitura e dispensa individuais.
- Cada alerta abre o contexto correto: compromisso, fatura, categoria do planejamento ou meta.
- Primeira entrega dentro do app. E-mail e push não são pressupostos desta etapa.

### Modelo e execução

- Registros persistentes de notificações, preferências e execução, com destinatário, espaço, origem e chave única de deduplicação.
- Usar agendamento durável compatível com a infraestrutura verificada; não depender de temporizador na memória do processo web.
- Considerar fuso horário configurado, retomada após indisponibilidade, tentativas e resolução de alertas que deixaram de fazer sentido.
- Usar os mesmos cálculos de orçamento/benefícios da tela de planejamento. Somente registros confirmados disparam eventos financeiros.
- Não criar um novo alerta idêntico a cada acesso ou importação repetida.

### Critério de conclusão

Demonstrar geração, deduplicação, leitura, dispensa e encerramento. Testar virada de dia/mês, vencimento alterado, pagamento, reversão e falha/reexecução do agendador.

## 5. Consolidar reconhecimento assistido

### Produto

- Reaproveitar os candidatos existentes; oferecer uma fila de movimentos sem agente ou com sugestões ambíguas.
- Mostrar o motivo: nome, abreviação ou descrição semelhante, com a descrição original e o agente sugerido.
- Permitir aceitar, rejeitar e corrigir uma sugestão; revisar o conjunto afetado antes de aplicar em lote.
- Aprender um vínculo confirmado para o histórico e os próximos movimentos, preservando classificações manuais.
- Identidade e categoria continuam independentes; a mesma pessoa pode aparecer em receitas e despesas.

### Modelo e proteção do histórico

- Registrar confirmações/rejeições quando necessário para não repetir sugestões recusadas; permitir revisão posterior.
- Reconhecimento exato de vínculos confirmados pode continuar automático. Semelhança e ambiguidade exigem confirmação.
- Não fundir pessoas só por nome; homônimos, estabelecimentos e origens de pagamento devem permanecer distinguíveis.
- Não modificar valores, datas, saldo ou conciliação ao reconhecer agentes.
- Testar desempenho em históricos maiores e processamento em lote idempotente.

### Critério de conclusão

Validar acentos, pontuação, abreviações, nomes incompletos, homônimos e descrições de Pix/cartão. Confirmar e desfazer vínculos sem perda de dados e sem sobrescrever escolhas manuais.

## 6. Compartilhar espaços

### Arquitetura e permissões

Hoje a API e o banco verificam propriedade pelo usuário. Esta etapa exige revisar o acesso completo, incluindo serviços, repositórios, RLS, referências, backups, importações e limpeza de espaços; esconder botões não autoriza nem protege operações.

- Membros por espaço, com papéis proprietário, editor e leitor.
- Proprietário administra membros, convites, exclusão/restauração do espaço e restauração de backup.
- Editor administra dados financeiros; não administra membros nem exclui o espaço.
- Leitor consulta; não altera dados. Exportação e operações em lote exigem permissão explícita definida na matriz.
- Separar proprietário do espaço, autor de uma alteração e usuário que lê o registro.
- Migrar espaços atuais para um proprietário/membro equivalente, mantendo os IDs e os dados.
- Revisar todo acesso baseado em `user_id` para que dados compartilhados sejam visíveis corretamente sem abrir acesso a outros espaços.

### Produto e convites

- Gerenciar membros no contexto do espaço, com indicação do papel atual.
- Convite por link copiável, token protegido, prazo de validade e revogação; aceitação autenticada e vinculada ao destinatário verificado.
- Impedir consumo duplicado do convite, elevação de privilégios e remoção do último proprietário.
- Revogação bloqueia novas requisições e invalida a visão/cache do membro; operações em andamento e concorrência precisam de comportamento definido.
- Notificações respeitam destinatário, preferências e participação atual. Acesso ao espaço excluído permanece bloqueado durante a lixeira.
- Manter controle de versões para edições concorrentes e registrar autoria das mudanças relevantes.

### Critério de conclusão

Testes de API e banco com três usuários e vários espaços, cobrindo leitura, escrita, URL direta, importação, exportação, backup, convite expirado/revogado, remoção de membro e lixeira. Não publicar enquanto existir um caminho sem autorização equivalente à matriz.

## 7. Validar integrado e abrir beta fechado

- Executar jornadas completas que atravessem metas, importação, orçamento, alertas e membros.
- Verificar instalação/atualização da PWA e garantir que o cache não conserva dados financeiros de outro usuário/espaço.
- Confirmar migrations e jobs no ambiente de teste; preparar recuperação e rollback de aplicação compatível com cada mudança de schema.
- Conferir logs sem credenciais/dados pessoais, sinais de falha dos jobs e diagnóstico de operações que não concluíram.
- Preparar onboarding curto, contas de demonstração sintéticas e lista explícita dos formatos aceitos.
- Liberar para um grupo pequeno, registrar problemas reais e corrigir antes de ampliar o público.

### Critério de conclusão

Sem bloqueadores conhecidos de isolamento, integridade financeira ou recuperação; fluxos críticos comprovados no ambiente publicado; limitações documentadas e canal de feedback funcionando.

## Disciplina de entrega

- Um incremento revisável por vez, com teste proporcional ao risco e validação integrada nas fronteiras financeiras e de permissão.
- Novas migrations incrementais; nunca editar migrations já aplicadas. Testar tanto banco vazio quanto atualização de uma instalação existente.
- Gerar OpenAPI/tipos quando contratos mudarem; atualizar exportação/restauração e limpeza para cada novo conjunto de dados.
- Antes de publicar dependências de schema/jobs, comprovar sua aplicação no destino. Se a conexão estiver bloqueada, preparar o comando exato e solicitar somente o resultado sem credenciais.
- Não tratar push, build ou teste listado como deploy, teste executado ou validação visual concluída.
- Manter um registro curto por etapa: entregue, verificado, limitação e próximo incremento. Falhas observadas têm prioridade sobre ampliar escopo.
