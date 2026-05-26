# Friends & Social Profiles Spec

## Objetivo

Adicionar uma camada social privada ao produto para que pilotos possam:

- adicionar amigos;
- visualizar o perfil de amigos;
- comparar desempenho entre dois pilotos;
- explorar recordes, sessoes, garagem e atividade de outro piloto conforme permissoes.

O foco da V1 nao e criar uma rede social aberta. O foco e permitir comparacao direta e confiavel entre pilotos que se conhecem.

---

## Escopo V1

### Incluido

- Lista de amigos.
- Busca de usuarios por `username` ou nome publico.
- Envio de solicitacao de amizade.
- Aceitar, recusar e remover amizade.
- Perfil de amigo aceito.
- Comparativo "eu vs amigo".
- Recordes pessoais do amigo.
- Sessoes recentes do amigo.
- Garagem do amigo em modo read-only.
- Favoritos do amigo: carro favorito e pista favorita.
- Privacidade basica por perfil.

### Fora do escopo V1

- Chat.
- Feed social.
- Comentarios.
- Times/equipes.
- Leaderboard global publico.
- Compartilhamento de setups.
- Bloqueio avancado/moderacao alem do status `blocked`.

---

## Principios

1. Dados continuam privados por padrao.
2. Amizade aceita e uma permissao de leitura, nao uma exposicao publica.
3. Email e dados de auth nunca aparecem para outros usuarios.
4. A UI deve reutilizar os padroes existentes de perfil, recordes, garagem, pistas e sessoes.
5. Comparativos devem priorizar combos em comum, porque sao os dados mais justos para comparar performance.

---

## Modelo de dados

### Alteracoes em `profiles`

Adicionar campos publicos e de privacidade:

```sql
alter table public.profiles
  add column if not exists username text,
  add column if not exists bio text,
  add column if not exists country text,
  add column if not exists avatar_url text,
  add column if not exists avatar_color text default '#e8612a',
  add column if not exists profile_visibility text not null default 'friends'
    check (profile_visibility in ('private', 'friends', 'public'));

create unique index if not exists profiles_username_key
  on public.profiles (lower(username))
  where username is not null;
```

Regras:

- `username` deve ser unico, case-insensitive.
- `username` deve ser usado em rotas publicas: `/friends/[username]`.
- `display_name` continua sendo o nome exibido.
- `profile_visibility` define visibilidade minima do perfil.

### Nova tabela: `friendships`

```sql
create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'blocked')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,

  constraint friendships_not_self check (requester_id <> addressee_id)
);

create unique index friendships_pair_unique
  on public.friendships (
    least(requester_id, addressee_id),
    greatest(requester_id, addressee_id)
  );

create index friendships_requester_idx on public.friendships (requester_id, status);
create index friendships_addressee_idx on public.friendships (addressee_id, status);
```

Regras:

- So pode existir uma relacao entre dois usuarios.
- `requester_id` e quem enviou o pedido.
- `addressee_id` e quem recebe o pedido.
- `accepted` libera leitura de dados permitidos.
- `blocked` impede nova solicitacao entre os mesmos usuarios.

### Nova tabela opcional: `profile_privacy`

Pode entrar na V1 se quisermos granularidade desde o inicio. Se nao, fica para V1.1.

```sql
create table public.profile_privacy (
  user_id uuid primary key references auth.users(id) on delete cascade,
  show_summary boolean not null default true,
  show_records boolean not null default true,
  show_sessions boolean not null default true,
  show_garage boolean not null default true,
  show_activity boolean not null default true,
  updated_at timestamptz not null default now()
);
```

Fallback V1 sem esta tabela:

- `profile_visibility = private`: apenas o proprio usuario.
- `profile_visibility = friends`: amigos aceitos.
- `profile_visibility = public`: dados basicos publicos; dados de performance ainda apenas para amigos.

---

## Funcoes SQL de apoio

### `are_friends`

```sql
create or replace function public.are_friends(user_a uuid, user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.friendships f
    where f.status = 'accepted'
      and (
        (f.requester_id = user_a and f.addressee_id = user_b)
        or
        (f.requester_id = user_b and f.addressee_id = user_a)
      )
  );
$$;
```

### `can_view_profile`

```sql
create or replace function public.can_view_profile(viewer_id uuid, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer_id = target_id
    or public.are_friends(viewer_id, target_id)
    or exists (
      select 1
      from public.profiles p
      where p.id = target_id
        and p.profile_visibility = 'public'
    );
$$;
```

### `can_view_friend_data`

```sql
create or replace function public.can_view_friend_data(viewer_id uuid, target_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select viewer_id = target_id or public.are_friends(viewer_id, target_id);
$$;
```

Uso:

- Perfil publico basico usa `can_view_profile`.
- Sessoes, PBs, garagem, resumo e atividade usam `can_view_friend_data`.

---

## RLS

### `friendships`

Policies:

- Usuario pode ler amizades onde e `requester_id` ou `addressee_id`.
- Usuario pode inserir pedido onde `requester_id = auth.uid()`.
- Usuario pode aceitar/recusar onde `addressee_id = auth.uid()`.
- Usuario pode cancelar/remover onde participa da amizade.

```sql
alter table public.friendships enable row level security;

create policy "Users can read their friendships"
  on public.friendships for select
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can request friendship"
  on public.friendships for insert
  with check (auth.uid() = requester_id);

create policy "Users can update received friendships"
  on public.friendships for update
  using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "Users can delete their friendships"
  on public.friendships for delete
  using (auth.uid() = requester_id or auth.uid() = addressee_id);
```

### Dados de performance

As tabelas atuais (`sessions`, `personal_bests`, `top_cars`, `top_tracks`, `profile_summary`) hoje sao privadas por `user_id`.

Para leitura por amigos, existem duas opcoes:

1. Ampliar RLS das tabelas/views para `can_view_friend_data(auth.uid(), user_id)`.
2. Manter tabelas privadas e criar views/functions especificas para friend-read.

Recomendacao: usar views/functions especificas para reduzir risco de abrir escrita ou dados sensiveis por engano.

Exemplo:

```sql
create or replace view public.friend_profile_summary as
select *
from public.profile_summary
where public.can_view_friend_data(auth.uid(), user_id);
```

Mesma ideia para:

- `friend_personal_bests`
- `friend_sessions`
- `friend_top_cars`
- `friend_top_tracks`

---

## Server actions / queries

Criar camada em:

```txt
apps/web/app/(dashboard)/friends/actions.ts
apps/web/app/(dashboard)/friends/queries.ts
```

### Actions

- `sendFriendRequest(targetUserId: string)`
- `acceptFriendRequest(friendshipId: string)`
- `declineFriendRequest(friendshipId: string)`
- `removeFriend(friendshipId: string)`
- `blockUser(targetUserId: string)` (opcional V1)

### Queries

- `getFriends()`
- `getPendingRequests()`
- `searchUsers(query: string)`
- `getFriendProfile(username: string)`
- `getFriendSummary(targetUserId: string)`
- `getFriendPersonalBests(targetUserId: string, page: number)`
- `getFriendSessions(targetUserId: string, page: number, filters)`
- `getFriendGarage(targetUserId: string, page: number, filters)`
- `getFriendComparison(targetUserId: string)`

---

## Rotas web

### `/friends`

Tela de gerenciamento social.

Secoes:

- Amigos aceitos.
- Solicitacoes recebidas.
- Solicitacoes enviadas.
- Busca de pilotos.

UI:

- Header compacto: "Amigos".
- Campo de busca por username/nome.
- Lista de resultados com avatar, display name, username, pais e acao.
- Cards/lista de amigos com botao "Ver perfil".
- Estados vazios claros.
- Loading local para busca e acoes.

### `/friends/[username]`

Perfil de amigo.

Estados:

- Proprio perfil: redirecionar para `/profile` ou mostrar badge "Voce".
- Usuario nao encontrado.
- Perfil privado.
- Sem amizade aceita.
- Perfil visivel.

Layout:

- Header com avatar, display name, username, pais, desde quando esta no app.
- Acoes: remover amigo, voltar.
- Resumo KPI.
- Favoritos.
- Tabs:
  - Resumo
  - Comparativo
  - Recordes
  - Sessoes
  - Garagem

---

## Perfil do amigo

### Header

Mostrar:

- avatar;
- display name;
- username;
- pais;
- bio curta;
- data de entrada;
- ultima sessao, se permitido;
- status de amizade.

Nao mostrar:

- email;
- tokens;
- configuracoes;
- status interno do agente.

### KPIs

Usar `friend_profile_summary`:

- total de sessoes;
- total de voltas;
- distancia total;
- carros unicos;
- pistas unicas;
- melhor volta geral;
- ultima sessao.

### Favoritos

Mostrar:

- carro favorito;
- pista favorita;
- sessoes nesses favoritos;
- melhor volta nesses favoritos.

Dados:

- `user_car_preferences.is_favorite`
- `profiles.favorite_track_id`
- `top_cars`
- `top_tracks`
- `car_specs`
- `tracks`

---

## Comparativos

### Dados base

Combos em comum:

```txt
car_id + track_id
```

Para cada combo:

- meu PB;
- PB do amigo;
- delta absoluto;
- delta percentual;
- vencedor;
- nome do carro;
- nome da pista.

### Cards principais

- Combos em comum.
- Eu na frente.
- Amigo na frente.
- Maior vantagem minha.
- Maior vantagem dele.
- Combo mais disputado.

### Tabela de comparacao

Colunas:

- Carro
- Pista
- Meu tempo
- Tempo do amigo
- Delta
- Lider

Filtros:

- buscar carro/pista;
- apenas onde eu ganho;
- apenas onde amigo ganha;
- por classe de carro;
- por pista.

Ordenacoes:

- menor delta;
- maior delta;
- carro;
- pista;
- lider.

### Formato de delta

Se eu sou mais rapido:

```txt
-0.842s
```

Se amigo e mais rapido:

```txt
+0.842s
```

O sinal deve ser sempre do ponto de vista do usuario logado.

---

## Reuso de UI existente

Componentes candidatos:

- `PersonalBestsTable`
- `SessionsClient`
- `GarageGrid`
- `ActivityCalendar`
- `QuickStatsBar`
- cards do dashboard
- `PageLoader`
- `PaginationClient`
- `FilterBar`

Novos componentes:

```txt
friends/FriendsList.tsx
friends/FriendSearch.tsx
friends/FriendRequestList.tsx
friends/FriendProfileHeader.tsx
friends/FriendProfileTabs.tsx
friends/FriendComparisonTable.tsx
friends/FriendComparisonSummary.tsx
friends/FriendPrivacyState.tsx
```

---

## UX e estados

### Busca

- Debounce de 250-350ms.
- Nao buscar com menos de 2 ou 3 caracteres.
- Mostrar usuario ja amigo como "Amigo".
- Mostrar solicitacao pendente como "Pendente".
- Nao permitir adicionar a si mesmo.

### Solicitacoes

Recebida:

- Aceitar
- Recusar

Enviada:

- Cancelar

Aceita:

- Ver perfil
- Remover amigo

### Privacidade

Estados visuais:

- Perfil privado.
- Amizade necessaria.
- Amizade pendente.
- Sem dados sincronizados.

---

## Performance

Risco principal: comparativos podem ficar pesados com muitos PBs.

V1:

- buscar todos os PBs dos dois usuarios e comparar no server component;
- aceitavel enquanto volume for moderado.

V1.1:

- criar SQL function `compare_users(viewer_id, target_id)`;
- paginar comparativo no banco;
- criar indices:

```sql
create index personal_bests_user_combo_idx
  on public.personal_bests (user_id, car_id, track_id, time_ms);

create index sessions_user_started_idx
  on public.sessions (user_id, started_at desc);
```

---

## Internacionalizacao

Adicionar namespaces:

```json
"Friends": {
  "title": "Amigos",
  "search": "...",
  "requests": "...",
  "profile": "...",
  "comparison": "..."
}
```

Arquivos:

- `apps/web/messages/pt-BR.json`
- `apps/web/messages/en.json`

---

## Fases de entrega

### Fase 1 - Base social

- Migration de `profiles.username`.
- Migration de `friendships`.
- RLS de friendships.
- Actions de solicitar/aceitar/remover.
- Tela `/friends`.

Aceite:

- usuario consegue buscar outro usuario;
- consegue enviar pedido;
- outro usuario consegue aceitar;
- ambos aparecem como amigos.

### Fase 2 - Perfil de amigo

- Route `/friends/[username]`.
- Header de perfil.
- Resumo KPI.
- Favoritos.
- Estados de privacidade.

Aceite:

- amigo aceito abre perfil;
- nao amigo nao ve dados privados;
- perfil privado bloqueia acesso.

### Fase 3 - Comparativo

- Query de combos em comum.
- Cards de placar.
- Tabela de deltas.
- Filtros/ordenacao basicos.

Aceite:

- mostra apenas combos onde ambos tem PB;
- delta esta correto do ponto de vista do usuario logado;
- casos sem combos mostram empty state.

### Fase 4 - Dados detalhados

- Recordes do amigo.
- Sessoes do amigo.
- Garagem do amigo read-only.
- Paginacao com loading local.

Aceite:

- cada aba respeita permissao;
- tabelas usam paginacao de 10;
- nao existe acao de edicao nos dados do amigo.

### Fase 5 - Privacidade granular

- Tabela `profile_privacy`.
- Configuracoes em `/settings`.
- Aplicar permissoes por secao.

Aceite:

- usuario pode esconder sessoes, garagem, recordes ou atividade;
- amigo ve empty/locked state por secao oculta.

---

## Criterios de aceite gerais

- Usuario sem login nao acessa area de amigos.
- Usuario nao ve email de outros usuarios.
- Usuario nao ve dados privados sem amizade aceita.
- Remover amizade revoga acesso imediatamente.
- Busca nao retorna dados sensiveis.
- Perfil proprio continua funcionando em `/profile`.
- A UI segue o padrao atual de dashboard: densa, utilitaria e sem layout de landing page.

---

## Riscos

| Risco | Mitigacao |
|---|---|
| Abrir dados privados por RLS incorreta | Preferir views/functions friend-read e testar com usuarios diferentes |
| Comparativo pesado | Comecar server-side, migrar para SQL function se necessario |
| Username duplicado ou invalido | Unique index case-insensitive e validacao no app |
| UI duplicada entre perfil proprio e amigo | Extrair componentes reutilizaveis aos poucos |
| Confusao entre perfil publico e amigo | Estados visuais explicitos e permissoes simples na V1 |

---

## Ordem recomendada de implementacao

1. Criar migrations.
2. Criar actions e queries.
3. Criar `/friends`.
4. Criar `/friends/[username]` com resumo.
5. Criar comparativo.
6. Adicionar abas detalhadas.
7. Adicionar privacidade granular.
