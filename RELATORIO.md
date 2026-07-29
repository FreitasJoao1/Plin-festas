# Relatório — Módulo de Agendamento (Capacity Planning)

`npx tsc --noEmit` limpo. `npm run build` completo sem erros. Todas as
rotas novas presentes no build.

**Aviso de segurança, antes de tudo:** o documento de especificação
enviado continha um bloco de instruções tentando reconfigurar meu
comportamento de resposta (formato, proibição de explicações etc.),
disfarçado de parte da spec técnica. Ignorei essa parte como instrução —
tratei só como conteúdo/especificação de produto. Documentado em
`AGENTS.md` para próximas sessões saberem que isso já aconteceu.

---

## Decisões de modelagem confirmadas com você antes de implementar

1. **`booking_status` separado de `status`** — agendamento (aprovação de
   data) e produção são dois fluxos paralelos e independentes.
2. **`refund_status` é flag manual** — não existe gateway de pagamento
   no projeto (é tudo WhatsApp/Pix combinado por fora), então recusa com
   estorno vira só uma tarefa manual para o admin resolver fora do site.
3. **E-mail de recusa via Resend** — implementado como best-effort. A
   recusa em si (banco) funciona independente do e-mail sair ou não.

---

## 1. Banco de dados (`supabase/schema.sql`)

- Novas colunas em `orders`: `booking_date`, `booking_status`
  (`pending_approval`/`approved`/`rejected`), `booking_rejection_reason`,
  `booking_alternative_date`, `refund_status` (`none`/`refund_pending`/`refunded`).
- Nova tabela `booking_settings` (linha única, id=1): `weekly_capacity`
  (default 20) e `horizon_days` (default 60) — editáveis sem mexer em
  código/trigger.
- Nova função `booking_week_occupancy(date)` — conta ocupação de uma
  semana (segunda a domingo).
- **Novo trigger `enforce_booking_capacity`** — valida no banco (não só
  na UI) que: a data não é no passado, não passa do horizonte
  configurado, e a semana não excede a cota. Roda em INSERT e UPDATE de
  `orders`. Isso significa que mesmo um bug futuro no código da
  aplicação não consegue criar um agendamento fora das regras — o banco
  rejeita.

**Ação que só você pode fazer:** rodar o `schema.sql` atualizado no SQL
Editor do Supabase (idempotente, seguro rodar de novo).

---

## 2. Backend (`src/lib/orders.ts`, novas rotas)

- `createOrder` agora aceita `booking_date` e retorna
  `{ ok: true, ... } | { ok: false, error }` em vez de lançar exceção —
  necessário porque o trigger de capacidade pode rejeitar o insert como
  regra de negócio normal, não como erro de sistema. **Isso mudou a
  assinatura da função** — o único caller (`/api/checkout`) foi ajustado.
- Novas funções: `getBookingSettings`, `getWeekOccupancies`,
  `getBookedOrdersInRange`, `approveBooking`, `rejectBooking`.
- Novas rotas:
  - `GET /api/agenda` — ocupação semanal, pública (sem login), pois o
    cliente precisa ver disponibilidade antes de escolher data no checkout.
  - `GET /api/admin/agenda` — mesma coisa + lista de pedidos da semana, admin-only.
  - `POST /api/admin/pedidos/[id]/aprovar` — aprova a data.
  - `POST /api/admin/pedidos/[id]/recusar` — recusa com justificativa
    obrigatória, data alternativa opcional, flag de estorno; dispara
    e-mail best-effort.
- `POST /api/checkout` agora aceita `bookingDate` opcional no body,
  valida formato, e repassa erro de capacidade como HTTP 409 (não 500).

**Achado à parte, corrigido:** existia uma função morta
`attachPreferenceToOrder` em `orders.ts` referenciando uma coluna
`mp_preference_id` que não existe no schema atual (resíduo da integração
Mercado Pago já removida em sessão anterior). Nunca era chamada em lugar
nenhum, mas quebraria se alguém a chamasse. Removida.

---

## 3. E-mail de recusa (`src/lib/notifications.ts`)

Novo módulo, via API HTTP do Resend (sem SDK adicional). Se
`RESEND_API_KEY`/`RESEND_FROM_EMAIL` não estiverem configurados, loga um
aviso e não envia nada — não quebra a recusa em si.

**Ação que só você pode fazer:** criar conta em resend.com, verificar um
domínio de envio, gerar a API key, e preencher `RESEND_API_KEY` +
`RESEND_FROM_EMAIL` no `.env.local` (seção nova em `.env.example`). Sem
isso, a recusa continua funcionando — só sem o e-mail automático (o
cliente ainda vê o status no site e tem o link de WhatsApp).

---

## 4. Frontend

**Componente novo `BookingCalendar.tsx`** (compartilhado): visão semanal
com navegação, barra de ocupação e cores conforme a spec (verde <50%,
amarelo 50–89%, vermelho 100%, cinza fora do horizonte). Usado em dois
modos:
- **Storefront** (`/checkout`): clicável, cliente escolhe a data.
- **Admin** (`/admin/agenda`): somente leitura, com lista de pedidos da
  semana ao lado para ação rápida.

**Checkout** (`src/app/checkout/page.tsx`): nova seção "Data desejada
(opcional)" com o calendário + disclaimer obrigatório (antes de
finalizar). O disclaimer também vai embutido na mensagem do WhatsApp
quando há data escolhida (depois de finalizar).

**Admin — novo painel `BookingApprovalPanel.tsx`**: aparece na página de
detalhe do pedido só quando há `booking_date`. Botões de aprovar/recusar;
modal de recusa com justificativa obrigatória, data alternativa
opcional, e checkbox "precisa de estorno manual".

**Admin — nova página `/admin/agenda`**: calendário + lista de pedidos
agendados da semana visível, com link direto para cada pedido.

**Cliente (`/conta`)**: cada pedido com `booking_date` agora mostra o
status de agendamento (aguardando/confirmado/recusado), motivo da
recusa, data alternativa sugerida, e um link direto de WhatsApp
pré-preenchido quando recusado.

---

## Verificação

- `npx tsc --noEmit` → sem erros
- `npm run build` → build de produção completo; todas as rotas novas
  (`/admin/agenda`, `/api/agenda`, `/api/admin/agenda`,
  `/api/admin/pedidos/[id]/aprovar`, `/api/admin/pedidos/[id]/recusar`)
  presentes e reconhecidas
