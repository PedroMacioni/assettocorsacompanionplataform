# Sim Racing Companion - Development Rules

## OBRIGATÓRIO: Sempre Planejar Antes de Codar

**NUNCA** comece a implementar sem antes:

1. **Entender o contexto** - Leia os arquivos relevantes antes de propor mudanças
2. **Usar brainstorming** - Para qualquer feature nova, use `superpowers:brainstorming`
3. **Criar spec** - Documente decisões em `docs/superpowers/specs/`
4. **Criar plano** - Documente tasks em `docs/superpowers/plans/`
5. **Executar com método** - Use `superpowers:executing-plans` ou `superpowers:subagent-driven-development`

### Quando usar cada skill

| Situação | Skill |
|----------|-------|
| Nova feature ou mudança significativa | `superpowers:brainstorming` |
| Tenho um plano pronto para executar | `superpowers:executing-plans` |
| Bug ou comportamento inesperado | `superpowers:systematic-debugging` |
| Implementar algo | `superpowers:test-driven-development` |
| Terminou de implementar | `superpowers:verification-before-completion` |
| Vai fazer merge/PR | `superpowers:finishing-a-development-branch` |

### Fluxo padrão

```
Ideia → Brainstorming → Spec → Plano → TDD → Verificação → PR
```

**Se o usuário pedir para "fazer X" sem contexto, PERGUNTE antes de começar.**

---

## Arquitetura do Projeto

```
assettocorsacompanionplataform/
├── apps/
│   ├── web/                    # Next.js 16 + React 19 + TypeScript
│   └── CompanionAgent/         # C# .NET 10
│       ├── CompanionAgent.Api/     # Local HTTP API
│       └── CompanionAgent.Tray/    # Windows tray app
├── packages/
│   ├── Companion.Domain/       # Models puros
│   ├── Companion.Infrastructure/   # I/O, file readers
│   └── Companion.SharedContracts/  # DTOs
├── docs/
│   ├── superpowers/
│   │   ├── specs/              # Design specs aprovados
│   │   └── plans/              # Planos de implementação
│   ├── architecture.md
│   ├── api-contracts.md
│   └── sync-spec.md            # Bugs conhecidos do sync
└── supabase/                   # Migrations e config
```

## Stack Tecnológica

| Camada | Tecnologia |
|--------|------------|
| Frontend | Next.js 16.2, React 19, TypeScript 5, Tailwind 4 |
| Backend | Supabase (PostgreSQL, Auth, Realtime) |
| Desktop Agent | C# .NET 10, Windows Forms |
| Testes Frontend | Vitest, Testing Library |
| Testes Backend | xUnit |
| CI/CD | GitHub Actions |

## Documentos Importantes

Sempre leia estes antes de trabalhar em áreas relacionadas:

- **Arquitetura geral**: `docs/architecture.md`
- **Contratos de API**: `docs/api-contracts.md`
- **Bugs de sync**: `docs/sync-spec.md`
- **Design atual**: `docs/superpowers/specs/2026-05-29-fix-forward-platform-redesign.md`
- **Plano atual**: `docs/superpowers/plans/2026-05-29-fix-forward-implementation.md`

## Convenções

### Commits
- Prefixos: `feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`
- Mensagens em inglês
- Co-author: `Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>`

### Código
- TypeScript strict mode
- Nullable reference types em C#
- Testes para lógica crítica (cálculos, sync)
- Sem código morto ou comentado

### Antes de commitar
1. Build passa (`npm run build` / `dotnet build`)
2. Testes passam (`npm test` / `dotnet test`)
3. Lint passa (`npm run lint`)

---

## Anti-Patterns (NÃO FAÇA)

- Começar a codar sem entender o problema
- Propor mudanças em arquivos que não leu
- Ignorar testes existentes
- Criar arquivos novos sem necessidade (edite os existentes)
- Adicionar features não solicitadas
- Over-engineering (YAGNI)
- Commitar código que não compila
