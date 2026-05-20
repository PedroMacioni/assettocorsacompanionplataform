# Spec: Backend (Supabase)

## Visão geral

O backend é inteiramente Supabase: PostgreSQL para dados, Supabase Auth para autenticação, PostgREST para a API REST automática, e RLS para isolamento de dados por usuário.

Sem servidor de aplicação próprio em v1 — as regras de negócio simples (upsert, agregação) ficam em SQL (views + functions) ou no próprio agente.

---

## Schema do banco de dados

### Tabela: `profiles`

Criada automaticamente via trigger quando usuário se registra.

```sql
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- RLS
alter table public.profiles enable row level security;
create policy "Users can read their own profile"
  on public.profiles for select using (auth.uid() = id);
create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data->>'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

### Tabela: `sessions`

```sql
create table public.sessions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  source_id   text not null,           -- nome do arquivo JSON do CM (sem extensão)
  started_at  timestamptz not null,
  driver_name text,
  car_id      text not null,
  track_id    text not null,
  session_types text,
  laps        integer not null default 0,
  distance_km numeric(10,3),
  best_lap_ms integer,
  last_lap_ms integer,
  synced_at   timestamptz not null default now(),

  unique (user_id, source_id)          -- dedup: um usuário não pode ter dois registros com mesmo source_id
);

create index on public.sessions (user_id, started_at desc);
create index on public.sessions (user_id, car_id);
create index on public.sessions (user_id, track_id);

-- RLS
alter table public.sessions enable row level security;
create policy "Users manage their own sessions"
  on public.sessions for all using (auth.uid() = user_id);
```

---

### Tabela: `personal_bests`

```sql
create table public.personal_bests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  car_id      text not null,
  track_id    text not null,
  time_ms     integer not null,
  source_date bigint,                  -- timestamp Unix do personalbest.ini
  synced_at   timestamptz not null default now(),

  unique (user_id, car_id, track_id)   -- um melhor tempo por combinação carro+pista por usuário
);

create index on public.personal_bests (user_id, time_ms);

-- RLS
alter table public.personal_bests enable row level security;
create policy "Users manage their own personal bests"
  on public.personal_bests for all using (auth.uid() = user_id);
```

---

### View: `profile_summary`

Usada pelo dashboard — evita N+1 queries no frontend.

```sql
create or replace view public.profile_summary as
select
  user_id,
  count(*)                                    as total_sessions,
  sum(laps)                                   as total_laps,
  round(sum(distance_km)::numeric, 2)         as total_distance_km,
  count(distinct car_id)                      as unique_cars,
  count(distinct track_id)                    as unique_tracks,
  max(started_at)                             as last_session_at,
  min(best_lap_ms) filter (where best_lap_ms > 0) as fastest_lap_ms
from public.sessions
group by user_id;
```

---

### View: `top_cars`

```sql
create or replace view public.top_cars as
select
  user_id,
  car_id,
  count(*)                                    as sessions,
  sum(laps)                                   as total_laps,
  round(sum(distance_km)::numeric, 2)         as total_distance_km,
  min(best_lap_ms) filter (where best_lap_ms > 0) as best_lap_ms
from public.sessions
where car_id != '--'
group by user_id, car_id;
```

---

### View: `top_tracks`

```sql
create or replace view public.top_tracks as
select
  user_id,
  track_id,
  count(*)                                    as sessions,
  sum(laps)                                   as total_laps,
  round(sum(distance_km)::numeric, 2)         as total_distance_km,
  min(best_lap_ms) filter (where best_lap_ms > 0) as best_lap_ms
from public.sessions
where track_id != '--'
group by user_id, track_id;
```

Adicionar RLS nas views:
```sql
-- Views herdam a RLS das tabelas base quando criadas com security_invoker
alter view public.profile_summary set (security_invoker = true);
alter view public.top_cars        set (security_invoker = true);
alter view public.top_tracks      set (security_invoker = true);
```

---

## API

O PostgREST do Supabase expõe automaticamente todas as tabelas e views como REST.

### Endpoints que o agente usa

| Método | Endpoint | Descrição |
|---|---|---|
| `POST` | `/rest/v1/sessions` | Upsert de sessões. Header: `Prefer: resolution=merge-duplicates` |
| `POST` | `/rest/v1/personal_bests` | Upsert de personal bests |
| `GET` | `/rest/v1/sessions?user_id=eq.{uid}&select=source_id` | Listar source_ids sincronizados (alternativa ao cache local) |

### Endpoints que o web frontend usa

| Método | Endpoint | Descrição |
|---|---|---|
| `GET` | `/rest/v1/profile_summary?user_id=eq.{uid}&select=*` | Resumo do perfil |
| `GET` | `/rest/v1/sessions?user_id=eq.{uid}&order=started_at.desc&limit=50` | Sessões recentes |
| `GET` | `/rest/v1/sessions?user_id=eq.{uid}&order=started_at.desc` | Todas as sessões |
| `GET` | `/rest/v1/personal_bests?user_id=eq.{uid}&order=time_ms.asc` | Personal bests |
| `GET` | `/rest/v1/top_cars?user_id=eq.{uid}&order=total_distance_km.desc&limit=10` | Top carros |
| `GET` | `/rest/v1/top_tracks?user_id=eq.{uid}&order=sessions.desc&limit=10` | Top pistas |

Todos os requests incluem:
```
Authorization: Bearer {user_jwt}
apikey: {supabase_anon_key}
```

O RLS garante que o `user_id` no JWT corresponde ao `user_id` nos dados — o filtro `user_id=eq.{uid}` é opcional mas bom para clareza.

---

## Autenticação do agente

O agente usa o **Supabase JWT** do usuário (obtido ao fazer login no web).

**Fluxo:**
1. Usuário loga no web com email/senha
2. Web exibe na página de configurações: **Token de Agente** (o `access_token` do Supabase Auth)
3. Usuário copia e cola no agente
4. Agente inclui `Authorization: Bearer {token}` em todos os requests

**Problema:** JWT do Supabase expira em 1 hora por padrão.

**Solução:** Armazenar `refresh_token` junto com `access_token`. O agente usa o `refresh_token` para renovar o `access_token` antes de expirar via `POST /auth/v1/token?grant_type=refresh_token`.

Supabase C# SDK (`supabase-csharp`) faz isso automaticamente.

---

## Migrations

Organizar migrations em ordem numérica:

```
supabase/migrations/
  0001_create_profiles.sql
  0002_create_sessions.sql
  0003_create_personal_bests.sql
  0004_create_views.sql
  0005_create_profile_trigger.sql
```

---

## Limites e custos (Supabase Free Tier)

| Recurso | Limite Free | Expectativa v1 |
|---|---|---|
| Database | 500 MB | ~50 MB para 10k usuários |
| API requests | 500k/mês | OK para início |
| Auth users | Ilimitado | OK |
| Edge Functions | 500k invocações | Não usamos em v1 |

Upgrade para Pro ($25/mês) quando atingir limites.

---

## Checklist de implementação

- [ ] Criar projeto Supabase
- [ ] Executar migration 0001: `profiles`
- [ ] Executar migration 0002: `sessions`
- [ ] Executar migration 0003: `personal_bests`
- [ ] Executar migration 0004: views (`profile_summary`, `top_cars`, `top_tracks`)
- [ ] Executar migration 0005: trigger de auto-criação de perfil
- [ ] Configurar RLS em todas as tabelas e views
- [ ] Testar upsert de sessions com `Prefer: resolution=merge-duplicates`
- [ ] Testar RLS (usuário A não acessa dados do usuário B)
- [ ] Configurar Auth: email/senha habilitado, URL de redirect para o web
- [ ] Documentar `SUPABASE_URL` e `SUPABASE_ANON_KEY` para o agente e o frontend
