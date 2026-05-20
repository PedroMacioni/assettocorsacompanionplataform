# Roadmap

## v1 — MVP (meta: funcionando end-to-end)

### Fase 1: Backend (1–2 dias)
- [ ] Criar projeto Supabase
- [ ] Executar migrations (profiles, sessions, personal_bests, views)
- [ ] Configurar RLS
- [ ] Testar upsert via Postman/curl
- [ ] Configurar Auth (email/senha)

### Fase 2: Agente (3–5 dias)
- [ ] Criar projeto `CompanionAgent.Tray` na solution
- [ ] System tray com ícone e menu básico
- [ ] Integrar `LocalHistoryService` existente
- [ ] Implementar `SyncWorker` (timer + FileSystemWatcher)
- [ ] Implementar `SettingsStore` e janela de configurações
- [ ] Integrar Supabase C# SDK para upsert
- [ ] Implementar renovação de token
- [ ] Implementar `AutoStartManager`
- [ ] Publicar como single-file EXE
- [ ] Testar instalação limpa em máquina sem .NET

### Fase 3: Web (3–5 dias)
- [ ] Criar projeto Next.js
- [ ] Configurar Supabase Auth (login/register)
- [ ] Dashboard com summary cards
- [ ] Página de sessões com tabela
- [ ] Página de personal bests
- [ ] Página de configurações com token de agente
- [ ] Empty state para novos usuários
- [ ] Deploy no Vercel

### Fase 4: Integração e testes (2 dias)
- [ ] Testar fluxo completo: instalar agente → logar → sincronizar → ver no dashboard
- [ ] Testar com histórico real do CM (muitos arquivos)
- [ ] Testar reconexão após queda de rede
- [ ] Testar com token expirado
- [ ] Landing page básica

---

## v2 — Telemetria ao vivo

- Integrar `CollectorCore` no `CompanionAgent.Tray`
- WebSocket do agente → Supabase Realtime
- Dashboard com painel ao vivo (velocidade, RPM, temperatura)
- Histórico por volta (se o CM exportar)

## v3 — Comunidade

- Rankings globais por pista + carro
- Perfis públicos (opt-in)
- Comparação entre usuários
- Suporte a outros sims (iRacing, Automobilista 2)

---

## Decisões técnicas abertas

| Questão | Status |
|---|---|
| Instalador: WiX ou NSIS? | A definir na Fase 2 |
| Auto-update do agente: Squirrel.Windows? | A definir |
| Nome de domínio da plataforma | A definir |
| Plano de monetização (free vs paid) | A definir |
| Car/track IDs: usar slugs do AC ou resolver para nomes amigáveis? | A definir — pode usar a AC car database pública |
