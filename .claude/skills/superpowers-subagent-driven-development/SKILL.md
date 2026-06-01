---
name: superpowers:subagent-driven-development
description: Use to execute an implementation plan task-by-task using parallel subagents. Pass the path to a plan file (docs/superpowers/plans/*.md) as argument.
---

# Subagent-Driven Development

Executa um plano de implementação despachando subagentes paralelos para tarefas independentes, e sequenciais para tarefas com dependências.

## Como Usar

Invoque passando o caminho do plano:
```
/superpowers:subagent-driven-development docs/superpowers/plans/my-plan.md
```

## Processo de Execução

### 1. Ler e analisar o plano

Leia o arquivo de plano passado como argumento. Identifique:
- Todas as tasks e seus steps
- Quais tasks têm dependências entre si
- Quais tasks podem rodar em paralelo

### 2. Agrupar por dependência

Classifique as tasks em **ondas de execução**:
- **Onda 1**: Tasks sem dependências (podem rodar em paralelo)
- **Onda 2**: Tasks que dependem da Onda 1
- **Onda N**: Tasks que dependem da Onda N-1

**Regras de dependência:**
- Se task B importa tipos/funções criados pela task A → B depende de A
- Se task B modifica arquivo criado pela task A → B depende de A
- Se tasks não compartilham arquivos → podem ser paralelas

### 3. Executar onda por onda

Para cada onda, use o tool `Agent` para despachar subagentes **em paralelo** (múltiplos Agent tool calls no mesmo response):

```
Para cada task na onda:
  → Spawn Agent com prompt auto-contido descrevendo exatamente o que fazer
  → Incluir: arquivo(s) a criar/modificar, código exato do plano, verificação esperada
```

Aguarde todos os subagentes da onda completarem antes de iniciar a próxima onda.

### 4. Verificar e commitar após cada task

Cada subagent deve:
1. Ler o(s) arquivo(s) existente(s) antes de modificar
2. Criar ou modificar o(s) arquivo(s) conforme o plano
3. Rodar `cd apps/web && npx tsc --noEmit` para verificar
4. Fazer o commit especificado no plano

### 5. Relatório final

Ao concluir todas as ondas:
- Liste quais tasks foram completadas com sucesso
- Liste quais tiveram problemas (se houver)
- Indique próximos passos manuais (testes no browser, etc.)

## Regras de Qualidade

- **Nunca** pule a verificação TypeScript entre tasks
- **Nunca** faça commits com código que não compila
- Se um subagent falhar, resolva antes de continuar para a próxima onda
- Commits devem seguir o formato especificado no plano
- Sempre adicione `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>` nos commits

## Exemplo de Prompt para Subagent

```
Você é um subagent executando a Task X do plano de refactor.

**Objetivo:** [descrição da task]

**Arquivos a modificar/criar:**
- `path/to/file.ts`

**Código a implementar:**
[código exato do plano]

**Verificação:**
Após implementar, rode: cd apps/web && npx tsc --noEmit
Esperado: sem erros

**Commit:**
git add path/to/file.ts
git commit -m "feat: mensagem do plano"

Leia o arquivo existente antes de modificar. Não altere nada além do especificado.
```
