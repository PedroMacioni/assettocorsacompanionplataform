# Auth Improvements - Design Spec

**Data:** 2026-06-01
**Status:** Aprovado
**Autor:** Claude Opus 4.5 + Pedro Macioni

## Resumo

Melhorias no fluxo de autenticação do Sim Racing Companion para resolver:
1. Flash de conteúdo em rotas protegidas (conteúdo aparece antes do redirect)
2. Login automático indevido no botão "já tenho conta"
3. Ausência de botão de logout acessível
4. UX fragmentada entre páginas de login e registro

## Decisões de Design

| Aspecto | Decisão |
|---------|---------|
| Proteção de rotas | Middleware + Loading screen global |
| Logout | Dropdown no perfil do Sidebar (ícone ⋮) |
| Sessão | Expira após 30 dias de inatividade |
| Tela de auth | Email-first unificada em `/login` |
| OAuth | Google sempre visível |
| Usuário logado em /login | Redirect para dashboard |
| Recuperação de senha | Link "Esqueci a senha" padrão |
| URL | `/login` (mantém), `/register` redireciona |

---

## 1. Arquitetura de Proteção de Rotas

### Middleware

O `middleware.ts` intercepta todas as rotas protegidas antes de renderizar:

```
Request → Middleware → Verifica sessão Supabase
                            │
                    ┌───────┴───────┐
                    │               │
              Autenticado     Não autenticado
                    │               │
                    ▼               ▼
            Continua para     Redireciona para
            página pedida      /login?next={url}
```

### Rotas Protegidas (matcher)

- `/dashboard/*`
- `/sessions/*`
- `/analytics/*`
- `/garage/*`
- `/tracks/*`
- `/friends/*`
- `/profile` (próprio perfil, não `/profile/[username]` público)
- `/settings/*`
- `/download/*`
- `/agent/*`
- `/personal-bests/*`

### Rotas Públicas

- `/` (landing)
- `/login`
- `/auth/callback`
- `/auth/reset-password`
- `/profile/[username]` (perfil público)
- Assets estáticos (`/_next/*`, `/favicon.ico`, etc.)

### Loading State

Enquanto middleware verifica auth, o layout do dashboard mostra skeleton/spinner com logo do app.

---

## 2. AuthProvider Global

### Interface do Contexto

```typescript
interface AuthContext {
  user: User | null;           // Dados do usuário logado
  isLoading: boolean;          // True enquanto verifica sessão
  signOut: () => Promise<void>; // Função de logout
}
```

### Comportamento

- Inicializa verificando sessão do Supabase
- Escuta mudanças de auth (`onAuthStateChange`)
- `signOut()` limpa sessão e redireciona para `/login`
- Componentes consomem via `useAuth()` hook

### Integração com Server Components

- Páginas dashboard continuam buscando `getUser()` server-side (performance)
- AuthProvider serve como fallback e para ações client-side (logout)
- Não há duplicação de requests (Supabase cacheia sessão)

---

## 3. Tela de Auth Unificada (Email-First)

### URL e Redirects

| URL | Comportamento |
|-----|---------------|
| `/login` | Página principal de auth |
| `/register` | Redirect 308 para `/login` |
| `/login?next=/settings` | Após login, vai para `/settings` |

### Estados da Página

**Estado 1: INICIAL**
```
┌────────────────────────────────────┐
│      Sim Racing Companion          │
│                                    │
│  ┌──────────────────────────────┐  │
│  │   Continuar com Google       │  │
│  └──────────────────────────────┘  │
│                                    │
│  ─────────── ou ───────────        │
│                                    │
│  Email                             │
│  ┌──────────────────────────────┐  │
│  │ seu@email.com                │  │
│  └──────────────────────────────┘  │
│  ┌──────────────────────────────┐  │
│  │        Continuar →           │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Estado 2: EMAIL EXISTE (Login)**
```
┌────────────────────────────────────┐
│      Bem-vindo de volta!           │
│      seu@email.com  [trocar]       │
│                                    │
│  Senha                             │
│  ┌──────────────────────────────┐  │
│  │ ••••••••                     │  │
│  └──────────────────────────────┘  │
│  Esqueci minha senha               │
│                                    │
│  ┌──────────────────────────────┐  │
│  │          Entrar →            │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

**Estado 3: EMAIL NÃO EXISTE (Registro)**
```
┌────────────────────────────────────┐
│      Criar sua conta               │
│      seu@email.com  [trocar]       │
│                                    │
│  Nome                              │
│  ┌──────────────────────────────┐  │
│  │ Pedro Macioni                │  │
│  └──────────────────────────────┘  │
│  Senha                             │
│  ┌──────────────────────────────┐  │
│  │ ••••••••                     │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │      Criar conta →           │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### API de Verificação de Email

```
POST /api/auth/check-email
Body: { email: string }
Response: { exists: boolean }
```

**Segurança:**
- Rate limiting: máx 5 requests/minuto por IP
- Delay artificial de 200-500ms na resposta

### Fluxo de Recuperação de Senha

1. Usuário clica "Esqueci minha senha"
2. Supabase envia email com magic link
3. Link leva para `/auth/reset-password?code=xxx`
4. Usuário define nova senha
5. Redirect para `/dashboard`

---

## 4. Sidebar - Dropdown do Perfil

### Design do Card

```
┌─────────────────────────────┐
│ 🟠 PM    Pedro Macioni    ⋮ │  ← Três pontos (MoreVertical icon)
│          pedro@email.com    │
└─────────────────────────────┘
    + hover: bg-muted/50
    + cursor: pointer
```

### Dropdown ao Clicar

```
┌─────────────────────────────┐
│ 🟠 PM    Pedro Macioni    ⋮ │
│          pedro@email.com    │
└─────────────────────────────┘
        ┌─────────────────┐
        │ ⚙️ Configurações │
        │ ─────────────── │
        │ 🚪 Sair          │
        └─────────────────┘
```

### Mudanças no Sidebar

1. Remove link "Settings" da lista principal de navegação
2. Torna o card do perfil clicável
3. Adiciona dropdown com Popover/Menu
4. Consome `useAuth()` para `signOut()`

---

## 5. Configuração de Sessão (30 dias)

### Configuração via MCP Supabase

**IMPORTANTE:** Usar MCP do Supabase para configurar, não manualmente no dashboard.

```
Inactivity timeout: 2592000 (30 dias em segundos)
```

### Comportamento

| Cenário | Resultado |
|---------|-----------|
| Usuário acessa app diariamente | Sessão renovada automaticamente |
| Usuário fica 29 dias sem acessar | Próximo acesso renova sessão |
| Usuário fica 31 dias sem acessar | Precisa fazer login novamente |

---

## 6. Redirect de Usuário Logado

Quando usuário já autenticado acessa rotas públicas de auth:

| Rota | Ação |
|------|------|
| `/login` | Redirect 307 para `/dashboard` |
| `/register` | Redirect 308 para `/login` → depois 307 para `/dashboard` |
| `/` (landing) | Redirect 307 para `/dashboard` |

Verificação feita server-side no início de cada página.

---

## 7. Página de Reset de Senha

### Rota

`/auth/reset-password`

### Interface

```
┌────────────────────────────────────┐
│      Redefinir senha               │
│                                    │
│  Nova senha                        │
│  ┌──────────────────────────────┐  │
│  │ ••••••••                     │  │
│  └──────────────────────────────┘  │
│  Confirmar senha                   │
│  ┌──────────────────────────────┐  │
│  │ ••••••••                     │  │
│  └──────────────────────────────┘  │
│                                    │
│  ┌──────────────────────────────┐  │
│  │    Salvar nova senha →       │  │
│  └──────────────────────────────┘  │
└────────────────────────────────────┘
```

### Validações

| Campo | Regra |
|-------|-------|
| Nova senha | Mínimo 8 caracteres |
| Confirmar senha | Deve ser igual à nova senha |

### Tratamento de Erros

| Erro | Mensagem |
|------|----------|
| Link expirado | "Este link expirou. Solicite um novo link de recuperação." |
| Link inválido | "Link inválido. Solicite um novo link de recuperação." |
| Senhas não coincidem | "As senhas não coincidem." |
| Senha muito curta | "A senha deve ter no mínimo 8 caracteres." |

---

## 8. Estrutura de Arquivos

### Reorganização de Pastas

```
apps/web/
├── app/
│   ├── (auth)/                         # 🆕 Route group para auth
│   │   ├── login/
│   │   │   └── page.tsx                # Tela unificada email-first
│   │   ├── auth/
│   │   │   ├── callback/
│   │   │   │   └── route.ts            # OAuth callback (existente)
│   │   │   └── reset-password/
│   │   │       └── page.tsx            # 🆕 Formulário nova senha
│   │   └── layout.tsx                  # 🆕 Layout compartilhado auth
│   │
│   ├── (dashboard)/                    # Existente
│   │   └── layout.tsx                  # MODIFICAR - Loading state
│   │
│   ├── api/
│   │   └── auth/
│   │       └── check-email/
│   │           └── route.ts            # 🆕 Verifica se email existe
│   │
│   ├── register/
│   │   └── page.tsx                    # SUBSTITUIR - Redirect para /login
│   │
│   ├── layout.tsx                      # MODIFICAR - Adicionar AuthProvider
│   └── page.tsx                        # MODIFICAR - Redirect se logado
│
├── components/
│   └── layout/
│       └── Sidebar.tsx                 # MODIFICAR - Dropdown do perfil
│
├── hooks/                              # 🆕 Pasta de hooks
│   └── useAuth.ts                      # 🆕 Hook de auth
│
├── providers/                          # 🆕 Pasta de providers
│   └── AuthProvider.tsx                # 🆕 Contexto de auth
│
├── middleware.ts                       # 🆕 Proteção de rotas
│
└── lib/
    └── supabase/                       # Existente
```

### Layout do Route Group (auth)

```typescript
// app/(auth)/layout.tsx
export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
      <div className="w-full max-w-md p-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1>Sim Racing Companion</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
```

---

## 9. Ordem de Implementação

1. **Middleware + Loading state** (resolve flash de conteúdo)
2. **AuthProvider + useAuth hook** (base para as outras features)
3. **Reorganização de pastas** (route group auth, hooks/)
4. **Dropdown do Sidebar com logout**
5. **Tela de login unificada email-first**
6. **API check-email**
7. **Redirect de usuário logado**
8. **Reset de senha**
9. **Configuração de sessão via MCP Supabase**

---

## 10. Critérios de Sucesso

- [ ] Usuário não autenticado não vê conteúdo de páginas protegidas
- [ ] Loading screen aparece enquanto verifica auth
- [ ] Botão "já tenho conta" leva para tela de login (não loga automaticamente)
- [ ] Logout funciona e está acessível no dropdown do perfil
- [ ] Fluxo email-first funciona corretamente
- [ ] Reset de senha funciona end-to-end
- [ ] Sessão expira após 30 dias de inatividade
- [ ] Usuário logado é redirecionado para dashboard ao acessar /login
