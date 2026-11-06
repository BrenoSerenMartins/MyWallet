# Metas, assinaturas, alertas, revisão e compartilhamento

Implementação local de 2026-11-06. Não constitui comprovação de publicação nem de aplicação das migrations em produção.

## Uso

- **Contas → editar → Categorias padrão:** receita e despesa opcionais por conta. Escolha manual tem precedência; depois vem a regra reconhecida e, por último, o padrão. Alterar o padrão não recategoriza o histórico. Categorias arquivadas deixam de servir como fallback. A seleção explícita de “sem categoria” fica preservada.
- **Mais → Metas e reservas:** metas com alvo, prazo opcional, prioridade e situação. Alocar/liberar destina saldo de uma conta de dinheiro ou reserva à meta, sem lançar receita/despesa e sem alterar patrimônio. Benefícios, cartões e investimentos ficam fora. O saldo livre desconta todas as metas; não é possível alocar o mesmo dinheiro duas vezes. Se o saldo cair posteriormente, surge um aviso de cobertura insuficiente, preservando o histórico. Há desfazer com verificação de versão e saldo.
- **Cartões → Assinaturas e cobranças recorrentes:** previsões mensais com dia, categoria e intervalo de meses. O calendário do cartão define a fatura prevista. A previsão entra no orçamento, mas não cria compra nem dívida efetiva. Ao confirmar, cria a compra ou vincula uma compra compatível existente; uma cobrança por regra/mês. Cancelar a compra permite reconfirmar. Pausar a assinatura retira previsões futuras e preserva compras anteriores.
- **Sino → Alertas financeiros:** preferências por pessoa/espaço, antecedência de faturas, percentual do orçamento, saldo projetado negativo e metas com prazo/cobertura insuficiente. Ler e dispensar persistem. A mesma condição não gera uma nova notificação em cada consulta; uma condição resolvida pode alertar novamente se voltar. Atualização ao usar o sistema e depois de alterações. Sem e-mail, push ou processamento quando a aplicação está fechada nesta etapa.
- **Mais → Revisão assistida:** até 500 lançamentos recentes sem categoria. Sugestões explicam identificação exata, semelhança, regra ou padrão da conta. Pagamentos de fatura podem ser sugeridos por valor e proximidade do vencimento, sempre exigindo confirmação. Seleção única por lançamento, prévia de lote com validade de 30 minutos, confirmação transacional e idempotente. Rejeições persistem para a mesma assinatura da sugestão. Alterações manuais posteriores invalidam a prévia. Categorizações/identificações podem ser desfeitas se a versão não mudou; pagamentos são desfeitos no módulo de Cartões.
- **Seus espaços → Compartilhar:** proprietário cria convite para e-mail específico e compartilha o link por conta própria. O token é aleatório, armazenado apenas como hash, expira em sete dias e pode ser revogado. Aceite consulta a identidade autenticada no Supabase e exige e-mail confirmado correspondente. Editor consulta, altera finanças e exporta. Leitor consulta, sem alterações financeiras/exportação de backup. Apenas proprietário gerencia acessos e restaura backup. A consulta já permite acesso aos dados financeiros; exportação CSV construída no navegador não representa uma barreira contra cópia de informações que o leitor pode visualizar.

## Banco e autorização

Aplicar migrations `202611060002` a `202611060009` antes de publicar esta versão. A `202611060001_invoice_planning.sql` já pertence à versão anterior.

O namespace financeiro `user_id` continua sendo o proprietário do espaço. A transação verifica o ator autenticado separadamente em `wallet.actor_id`, resolve a associação ao espaço e então seleciona o namespace. Escritas financeiras mantêm locks compartilhados no espaço e no membro, coordenando a revogação. Políticas RLS restritivas também verificam a associação e permissão de escrita. GETs usam transações somente leitura, sem materialização financeira. Alertas pessoais têm políticas próprias para permitir que leitores leiam/dispensem seus avisos sem modificar dados financeiros.

A auditoria de contas, categorias, lançamentos, cartões, assinaturas, metas, alocações e planos registra o ator verificado e os valores antes/depois. Membros não têm acesso de escrita à auditoria. Convites, permissões e alertas pessoais não são transportados por backup.

## Backup e compatibilidade

Formato v13 inclui padrões por conta, metas/alocações e regras/ocorrências recorrentes dos cartões. Restauração remapeia contas, categorias, metas, alocações, cartões e compras, sem duplicar lançamentos. Padrões são restaurados após as categorias. Backups v1–v12 continuam aceitos sem os campos exclusivos de v13. Compartilhar ou restaurar finanças não concede participação no espaço original.

## Verificação

Testes de integração PGlite executam migrations com o papel restrito `plannedwallet_runtime`, cobrindo defaults por direção/arquivamento, saldos e exclusividade de reservas, desfazer, recorrências/previsões/confirmações, associação a compra existente, cancelamento, backup v13, revisão/rejeição/versão, leitor/editor/proprietário, revogação, convite inválido, autoria e alertas persistentes. Há cenários Playwright para metas e revisão em 390 e 1440 px. Evidência de execução deve ser registrada separadamente; listar testes não comprova execução em Chromium.

PGlite valida a semântica e as políticas usadas pelos serviços, mas não substitui verificação de concorrência com múltiplas conexões de PostgreSQL em produção. Antes de ampliar o beta compartilhado, validar revogação concorrente e limites de sessão nesse ambiente.
