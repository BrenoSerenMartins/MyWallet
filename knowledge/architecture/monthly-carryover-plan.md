# Plano — saldo trazido, competência de benefícios e reservas

Data: 2026-11-05. Estado: proposta para implementação; este documento não comprova entrega.

## Objetivo e decisões acordadas

Mostrar quanto está disponível para o mês sem transformar sobras em receitas novas, sem duplicar benefícios antecipados e sem disponibilizar reservas automaticamente para consumo. A configuração de competência permanece exclusiva dos benefícios VA/VR. Ela desloca apenas créditos positivos classificados como receita; despesas mantêm a data original. Resumo, planejamento, gráficos e consultas de período devem seguir esse mesmo critério.

A interface pode consolidar dinheiro e benefícios no total disponível, mantendo composição por conta acessível nos detalhes. Reservas e investimentos ficam no patrimônio, fora do disponível para consumo. O total consolidado não promete que benefícios possam pagar qualquer obrigação; não usar esse total para afirmar capacidade de pagar uma fatura ou compromisso sem verificar a conta elegível.

## 1. Conceitos e fórmulas

- Saldo bancário: posição real da conta na data, independente de competência.
- Receita: entrada nova classificada como receita, no período de competência.
- Saldo trazido: posição disponível antes do início do período, ajustada por créditos já recebidos cuja competência ainda não começou.
- Disponível: saldo trazido mais receitas, menos despesas, mais transferências líquidas com contas fora do orçamento, mais ajustes de saldo identificados separadamente.
- Resultado do mês: receitas menos despesas. Não inclui saldo trazido, transferências ou correções de saldo.
- Guardado no mês: aportes líquidos em reservas/investimentos originados em contas do orçamento. É uma destinação de recursos, não uma despesa.

Todos os cálculos usam inteiros em centavos e o mesmo recorte de espaço financeiro. Nunca somar o saldo atual de hoje a receitas históricas. Não persistir uma nova receita ou lançamento mensal para representar a sobra.

Para uma conta elegível e um início de período D:

`saldo trazido(D) = saldo bancário imediatamente antes de D − créditos recebidos antes de D com competência em D ou depois`

Os créditos antecipados são descontados integralmente, não limitados ao saldo remanescente. Se parte foi gasta antes da competência, o saldo trazido ajustado pode ser negativo; ocultar ou zerar esse valor faria o disponível divergir do dinheiro real.

A data de competência mensal hoje usada para antecipações é o primeiro dia do mês seguinte. Intervalos parciais devem seguir essa mesma data, sem inventar um dia equivalente no mês de destino. API trabalha com intervalos [início, fim); interface pode mostrar fim inclusivo e converter na requisição.

## 2. Exemplo principal e continuidade

Outubro recebe R$ 700 no dia 31, destinados a novembro. Novembro gasta R$ 600 e recebe mais R$ 700 no dia 30, destinados a dezembro.

| Período | Saldo bancário inicial | Crédito antecipado excluído do trazido | Saldo trazido | Receita de competência | Despesas | Disponível final |
|---|---:|---:|---:|---:|---:|---:|
| Novembro | 700 | 700 | 0 | 700 | 600 | 100 |
| Dezembro | 800 | 700 | 100 | 700 | 0 | 800 |

Em novembro, o banco termina com R$ 800, mas R$ 700 estão destinados a dezembro. O disponível de novembro termina em R$ 100. Na abertura de dezembro, os R$ 100 são sobra e os R$ 700 entram como receita, uma única vez.

Caso antecipado: havia R$ 0, entram R$ 700 destinados a novembro e são gastos R$ 50 ainda em outubro. Novembro abre com R$ 650 no banco, saldo trazido ajustado de −R$ 50 e receita de R$ 700: disponível R$ 650. Explicar a antecipação nos detalhes, sem alterar a data da compra nem fabricar receita/despesa.

Invariante para contas do orçamento, com evidência completa:

`disponível no corte = saldo bancário no corte − créditos já recebidos destinados a períodos futuros`

A continuidade entre fechamentos e aberturas deve ser comprovada por conta antes de consolidar o espaço.

## 3. Reservas, investimentos e transferências

- Contas de dinheiro e benefícios existentes integram o orçamento; reservas, cartões e posições de investimento não integram a abertura disponível.
- Transferências entre duas contas do orçamento não alteram o total consolidado. No detalhe de cada conta, entrada/saída aparece como transferência, sem virar receita/despesa.
- Aporte de R$ 400 para reserva reduz o disponível e aumenta o reservado; resgate de R$ 200 faz o inverso. Ambos preservam patrimônio, salvo rendimento ou perda registrados separadamente.
- Reserva para reserva não altera o orçamento. Transferências internas devem ser contadas por suas duas pontas, com identidade e reversão preservadas.
- Compra no cartão, pagamento da fatura e aporte/resgate de investimento seguem os fatos e vínculos já existentes. Não somar a despesa da compra e o pagamento outra vez. Separar capital resgatado de rendimento.
- O campo contribution existente é uma intenção de poupar. Não descontá-lo como se fosse aporte efetivo e depois descontar a transferência novamente. Mostrar meta prevista e guardado realizado separadamente.
- Mapear pagamentos/fluxos gerenciados antes de publicar a fórmula completa de disponível. Critério: o fechamento deve reconciliar com a posição disponível, sem duplicar eventos de módulos diferentes.

## 4. Reconstrução histórica e qualidade da informação

Usar as referências históricas de saldo, observações manuais, extratos confirmados e regras de inclusão já existentes. O método simples abertura + soma de lançamentos não serve quando há importações antigas incluídas numa referência posterior.

Criar uma leitura de posição por conta e data com valor, evidência, referência e estado de cobertura: comprovado, parcial ou indisponível. Não extrapolar um saldo atual para trás sem evidência suficiente; nunca apresentar ausência de histórico como zero. Contas criadas depois do início do período não recebem uma abertura retroativa fictícia.

Correção manual e referência de extrato entram como ajustes identificados, não receitas. Reversão, reimportação, correção da data e mudança de competência recalculam os períodos afetados. Não transportar a mesma correção de saldo duas vezes. Contas arquivadas continuam nos períodos em que tiveram posição/movimentos; não desaparecer dinheiro histórico por causa do estado atual.

Se parte das contas não tem abertura confiável, informar “Saldo trazido incompleto” e expor quais contas precisam de referência. Resultados de receitas/despesas conhecidos continuam consultáveis; não apresentar um disponível completo inventado.

## 5. API, dados e desempenho

1. Reutilizar a expressão única de competência para benefícios nos totais, filtros e séries. Auditar consultas fora do ledger antes de declarar cobertura universal.
2. Criar leitura histórica de posição através dos limites de integração entre accounts e planning/dashboard, sem dependências diretas entre repositórios de módulos.
3. Estender o contrato de resumo com saldo trazido, créditos antecipados excluídos, ajustes, transferências externas líquidas, reservado realizado, disponível e qualidade de cobertura. Definir nomes e nulabilidade no OpenAPI antes da interface.
4. Consolidar um serviço de cálculo por período, com decomposição por conta, usado por planejamento e dashboard. Evitar fórmulas financeiras duplicadas no frontend.
5. Preferir valores derivados. Se snapshots/cache forem necessários, versionar cálculo e invalidar por alterações de fatos, referências, competência, conta e espaço. Não criar migrations de lançamentos mensais fictícios.
6. Garantir leitura consistente dos componentes do cálculo, agregação em lote e evitar uma consulta por dia/conta. Medir com histórico longo e conferir planos SQL antes de criar índices.
7. Atualizar contratos gerados. Se houver novos dados persistidos, incluir migration, RLS, backup/restauração e versão do formato; não migrar nem reinterpretar silenciosamente fatos antigos.

## 6. Interface e consultas

Planejamento e “Seu mês”: saldo trazido, receitas novas, despesas, guardado/resgatado e disponível. Resultado mensal permanece identificável e separado do disponível. Planejado e realizado usam conceitos equivalentes; previsão de poupança não pode ser apresentada como dinheiro já guardado.

Detalhes de saldo trazido mostram contas incluídas, saldo na virada, crédito antecipado descontado e fonte da posição. Valores negativos explicam consumo antecipado; não recebem texto que sugira necessariamente erro bancário.

Gráficos oferecem receitas/despesas/resultado por competência e disponível inicial/final como séries distintas. A sobra não vira barra de receita. Crédito destinado ao próximo mês não cria melhora artificial no resultado do mês de recebimento.

Movimentações e filtros usam competência para inclusão no período, preservando a data bancária exibida. Identificar lançamentos cujo mês de competência difere, para que um crédito de outubro encontrado no filtro de novembro seja compreensível. Na exportação, incluir data original e competência em colunas distintas e informar o critério do filtro; não substituir a data original. Conferir se já existe exportação tabular real antes de criar essa entrega; backup JSON não equivale a planilha.

Privacidade oculta todos os valores derivados. Preservar filtros, URL, paginação, histórico do navegador, acessibilidade e layout móvel. Falhas no planejamento não podem afetar o cartão de saldo atual.

## 7. Validação obrigatória

- Exemplo dos dois créditos de R$ 700 com sobra de R$ 100, por pelo menos três meses.
- Benefício recebido no próprio mês; VA e VR com configurações diferentes; troca de ano e fevereiro bissexto.
- Crédito gasto parcialmente antes da competência; saldo trazido negativo e conciliação final.
- Receita bancária comum no último dia sem deslocamento; transferência, estorno e devolução não deslocados indevidamente.
- Apenas uma ponta da transferência no orçamento; duas pontas dentro; reserva/resgate; investimento; fatura sem dupla contagem.
- Conta sem histórico, abertura no meio do mês, conta arquivada e referência bancária posterior cobrindo fatos antigos.
- Reversão, reimportação, correção de saldo e alteração retroativa de competência sem perda ou duplicação.
- Períodos parciais, limites de data, filtros combinados e paginação sem omissão/repetição.
- Dashboard, planejamento, gráficos, consulta e exportação com o mesmo conjunto sintético e totais conciliáveis.
- Isolamento entre usuários/espaços, restauração, conflitos de versão e invalidação de cache.
- CI completo, contratos, 320/390/768/1440 px, temas, teclado e privacidade. Não considerar build/listagem de testes como execução de navegador.

## 8. Ordem de entrega e critérios

1. Fechar estabilização atual e registrar CI verde como baseline.
2. Especificar matriz de contas/eventos e posições históricas; comprovar os exemplos com testes de integração. Só então fixar o contrato do disponível.
3. Implementar leitura histórica e cálculo derivado, com qualidade de cobertura e reconciliação por conta.
4. Integrar planejamento e dashboard, mantendo resultado separado da sobra e poupança prevista separada da realizada.
5. Integrar gráficos, filtros, indicação de competência e exportação disponível no produto.
6. Conectar reservas/metas ao plano do próximo ciclo; evitar implementar duas fontes de alocação concorrentes.
7. Rodar regressão financeira, backup/restauração e navegador; conferir manualmente um conjunto conhecido antes de publicar.

Entregar em mudanças pequenas e revisáveis, com frontend/contratos compatíveis. Não ativar um “disponível” parcial sem rótulo de cobertura. Nenhuma etapa autoriza alterar extratos, reclassificar despesas, apagar a configuração de benefícios ou converter saldos em receitas.

Concluído quando a soma fecha por conta e por espaço, a sobra atravessa meses sem duplicação, o benefício segue sua competência, reservas não financiam automaticamente o orçamento e todas as visualizações explicam os mesmos valores.

## Execução registrada

2026-11-05: cálculo derivado, leitura da linhagem ativa de referências, decomposição de transferências/ajustes, integração de planejamento/dashboard, série de disponível e CSV de consulta implementados. A exportação de backup continua no formato existente, pois os novos totais são derivados. Valores sem prova histórica são apresentados como incompletos, sem extrapolação do saldo atual. Validação local: 237 testes, tipos, lint, limites, build e contratos passaram. Novos cenários de navegador adicionados; execução real pelo CI e revisão em dispositivo continuam pendentes. Recursos de metas e alocação virtual permanecem no plano do próximo ciclo.
