# Vision & Goals

## Produto

**Sim Racing Companion** — plataforma SaaS para pilotos de Assetto Corsa acompanharem sua evolução, histórico de sessões e tempos pessoais em um dashboard web acessível de qualquer lugar.

O produto consiste em dois artefatos:

- **CompanionAgent** — EXE instalado na máquina do usuário. Roda em segundo plano (system tray), lê dados do Content Manager e sincroniza automaticamente com o cloud.
- **Plataforma Web** — Dashboard global acessível via browser. Mostra estatísticas, histórico, personal bests e (futuro) rankings globais.

---

## Objetivos v1

| # | Objetivo |
|---|---|
| O1 | Usuário instala o agente em ~1 minuto e vê seus dados no dashboard sem configuração manual |
| O2 | Histórico completo de sessões do Content Manager sincronizado na nuvem |
| O3 | Personal bests sincronizados e exibidos por carro/pista |
| O4 | Dashboard web com resumo, top carros, top pistas, sessões recentes |
| O5 | Funciona para qualquer piloto no mundo (multi-tenant, auth por conta) |

---

## Fora do escopo v1

- Telemetria ao vivo (velocidade, RPM em tempo real) — v2
- Rankings globais / leaderboards — v2
- Suporte a outros sims (iRacing, rFactor, etc.) — v3
- App mobile — v3
- Replay analysis — v3

---

## Usuário-alvo

Pilotos de Assetto Corsa que usam **Content Manager** no Windows e querem acompanhar sua evolução sem gerenciar arquivos manualmente.

---

## Métricas de sucesso

- Tempo até ver dados no dashboard após instalar o agente: **< 2 minutos**
- Sync sem erros para 95%+ das sessões do CM
- Latência de sync após fechar o AC: **< 5 minutos**

---

## Restrições

| Restrição | Motivo |
|---|---|
| Agente é Windows-only | Assetto Corsa + Content Manager só existem no Windows |
| Web é multiplataforma | Dashboard acessível de qualquer SO/browser |
| Agente não pode abrir portas públicas | Usuário está atrás de NAT; sync é sempre agent → cloud (push) |
| Dados locais nunca sobem sem consentimento | Agente só sincroniza após login explícito do usuário |
