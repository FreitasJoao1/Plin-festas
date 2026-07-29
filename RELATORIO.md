# Relatório — Pagamento online opcional (InfinitePay)

`npx tsc --noEmit` limpo. `npm run build` completo sem erros. Todas as
rotas novas presentes.

---

## Decisões confirmadas com você antes de implementar

1. Você ainda não tem conta InfinitePay — implementado em modo "aditivo
   silencioso": sem `INFINITEPAY_HANDLE` configurado, o botão "Pagar
   agora" simplesmente não aparece, zero impacto no site atual.
2. **WhatsApp continua sendo o fluxo padrão.** Pagamento online é uma
   opção extra ao lado, não substitui nada.
3. **Pagamento confirmado NÃO avança o status do pedido sozinho.** Admin
   continua confirmando manualmente em `/admin/pedidos/[id]`, mesmo com
   o pagamento já registrado como pago.

---

## Ponto de segurança mais importante desta rodada

A documentação oficial da InfinitePay **não especifica assinatura/HMAC**
para o webhook — ou seja, qualquer pessoa que descobrisse a URL
`/api/pagamento/webhook` poderia, em teoria, enviar um payload forjado
alegando que um pedido foi pago.

Mitigação: **nada é gravado como pago só por ter recebido o webhook.**
Toda confirmação passa por uma segunda chamada server-to-server
(`payment_check`), autenticada pelo seu handle, que só a InfinitePay
consegue responder corretamente. O webhook é só o "gatilho" para ir
confirmar mais rápido — a fonte de verdade real é sempre essa segunda
chamada. O mesmo vale para o retorno do cliente ao site após pagar: os
parâmetros da URL de redirect também não são confiados sozinhos, a
página de status reconsulta o servidor.

---

## 1. Banco de dados (`supabase/schema.sql`)

- Novas colunas em `orders`: `payment_status` (`none`/`pending`/`paid`/`failed`),
  `payment_method` (`pix`/`credit_card`), `infinitepay_order_nsu`,
  `infinitepay_transaction_nsu`, `infinitepay_invoice_slug`,
  `infinitepay_paid_amount_cents`.
- **Trigger `enforce_client_cancel_only_status` foi estendido** — antes
  só sabia dois casos (admin vs. cliente cancelando). Agora tem um
  terceiro: chamada de sistema (`service_role`, usada pelo webhook e por
  `payment_check`), que só pode alterar campos de pagamento, nada mais.
  Documentei extensamente no schema por que isso é seguro (RLS bloqueia
  visitantes anônimos antes mesmo do trigger rodar) — vale a pena ler
  esse comentário se for mexer em RLS de `orders` no futuro.

**Ação que só você pode fazer:** rodar o `schema.sql` atualizado no SQL
Editor do Supabase.

---

## 2. Integração InfinitePay (`src/lib/infinitepay.ts`, novo)

- `createPaymentLink()` — gera o link de checkout hospedado (`POST /links`
  da API deles). Frete entra como item extra (a API não tem conceito de
  frete separado).
- `checkPayment()` — confirma pagamento via `POST /payment_check`. Esta é
  a única fonte confiável de "foi pago mesmo".

---

## 3. Backend — novas rotas

- `POST /api/pagamento/[orderId]/link` — gera o link pra um pedido já
  criado (não cria pedido novo, reusa o mesmo `POST /api/checkout` de
  sempre).
- `POST /api/pagamento/webhook` — recebe aviso da InfinitePay, sempre
  reconfirma via `checkPayment()` antes de gravar qualquer coisa.
- `GET /api/pagamento/status` — consultada pela página de retorno;
  primeiro olha o banco, e se o webhook ainda não chegou, confirma
  ativamente usando os parâmetros do redirect.
- `GET /api/pagamento/config` — expõe só um `{ available: boolean }`,
  nunca a credencial, pro front saber se deve mostrar o botão.

`src/lib/orders.ts` ganhou `getOrderByCode`, `markPaymentPending`,
`markPaymentConfirmed` (esta última é a ÚNICA função que grava
`payment_status='paid'` em todo o projeto — documentado no código e no
`AGENTS.md` pra não vazar esse padrão no futuro).

---

## 4. Frontend

- **Checkout**: segundo botão "Pagar agora (Pix ou cartão)" ao lado do
  "Finalizar via WhatsApp", só aparece se `/api/pagamento/config`
  confirmar que está disponível. Cria o pedido do mesmo jeito, depois
  redireciona pro checkout hospedado da InfinitePay.
- **Página nova `/checkout/pagamento`**: retorno pós-pagamento, faz
  polling no status até confirmar (ou até desistir e sugerir WhatsApp).
- **Admin** (`/admin/pedidos/[id]`): novo bloco mostrando status de
  pagamento, método, valor pago e ID da transação, quando existir.
- **Cliente** (`/conta`): selo "✅ Pago" ou "⏳ Pagamento pendente" ao
  lado do total de cada pedido.

---

## Ação que só você pode fazer

Criar conta em https://www.infinitepay.io, pegar sua InfiniteTag (handle,
sem o `$`), e preencher `INFINITEPAY_HANDLE` no `.env.local` (seção nova
em `.env.example`). Sem isso, tudo continua funcionando exatamente como
antes — o botão de pagamento só não aparece.

---

## Verificação

- `npx tsc --noEmit` → sem erros
- `npm run build` → completo; rotas `/checkout/pagamento`,
  `/api/pagamento/[orderId]/link`, `/api/pagamento/webhook`,
  `/api/pagamento/status`, `/api/pagamento/config` presentes
