# AGENTS.md — guia técnico para IAs trabalhando neste repositório

Este arquivo existe para uma IA entender o projeto inteiro rápido, antes
de fazer qualquer mudança. Leia isto por completo antes de editar código.
`README.md` é para humanos (o que o produto é); este arquivo é para
agentes (como o código é organizado e por quê).

## O que este projeto NÃO tem (histórico importante)

Já existiu, em sessões anteriores, uma versão deste projeto com
integração de pagamento via **Mercado Pago** (webhook, preferências de
pagamento, páginas de sucesso/erro). Essa integração foi **removida
deliberadamente** — o modelo de negócio atual é 100% checkout-via-WhatsApp,
sem gateway de pagamento. Se você encontrar qualquer menção a Mercado
Pago em memória de conversa anterior, documentação externa, ou pedido do
usuário que pressuponha isso existir, trate como desatualizado e
confirme com o usuário antes de reintroduzir qualquer coisa nessa linha.
Não existe `mp_preference_id` funcional em uso nem rota de webhook no
código atual.

## Modelo mental do fluxo principal

```
Cliente monta carrinho (Zustand, localStorage)
  → /checkout preenche dados + escolhe frete
  → POST /api/checkout (server recalcula TUDO: preço, frete, total —
     nunca confia no client)
  → cria linha em `orders` com status='novo'
  → client monta URL wa.me e redireciona pro WhatsApp da loja
  → dono da loja combina produção/pagamento por WhatsApp
  → admin avança o status manualmente em /admin/pedidos/[id]
     (novo → confirmado → em_producao → pronto → enviado → entregue)
  → cliente logado pode cancelar o PRÓPRIO pedido em /conta, mas só
     enquanto o status ainda é 'novo' ou 'confirmado'
```

## Arquitetura de autorização (ler antes de mexer em qualquer permissão)

Existem DUAS fontes de identidade que parecem sobrepor mas não são
intercambiáveis:

1. **`public.profiles.role`** ('cliente' | 'admin') — a ÚNICA fonte de
   verdade para privilégio de admin. Protegida por RLS (cliente não pode
   se autopromover — ver policy `profiles_update_own`, que trava
   `role = 'cliente'` no `with check`). Todo gate de admin real (middleware,
   `requireAdmin()` em `src/lib/auth.ts`, RLS de `orders`/`products`) usa
   esta coluna.
2. **`auth.users.user_metadata`** — editável pelo PRÓPRIO usuário via
   `supabase.auth.updateUser({ data: {...} })`. NUNCA usar nenhum campo
   daqui para decidir permissão ou renderizar UI sensível (ex: um botão
   de "Painel Admin"). Isso já foi uma vulnerabilidade neste projeto (ver
   RELATORIO.md, seção mais recente) — o Header e a página `/conta`
   decidiam `isAdmin` olhando `user_metadata.is_admin`, que qualquer
   usuário podia setar em si mesmo. Foi corrigido para ler sempre de
   `profiles.role`. Não reintroduza esse padrão.

Camadas de proteção do `/admin`, em ordem:
- `middleware.ts` → `src/lib/supabase/middleware.ts`: bloqueia navegação
  para `/admin/*` se não for admin (olha `profiles.role`).
- Cada rota em `/api/admin/*` chama `requireAdmin()` (`src/lib/auth.ts`)
  de novo, independentemente — o matcher do middleware NÃO cobre
  `/api/admin/*`, então a rota tem que se proteger sozinha.
- RLS no Postgres é a última linha de defesa, mesmo que as duas camadas
  acima falhem.

## Cancelamento de pedido pelo cliente — como funciona e por que assim

Regra de negócio: cliente cancela o próprio pedido só se o status ainda
for `novo` ou `confirmado` (ou seja, ainda não `em_producao`, `pronto`,
`enviado` ou `entregue`).

Isso é aplicado em TRÊS camadas independentes (defesa em profundidade —
não remova nenhuma achando redundante):

1. **UI** (`src/app/conta/page.tsx`): só mostra o botão "Cancelar
   pedido" se `CANCELABLE_STATUSES.includes(order.status)`.
2. **API** (`src/app/api/pedidos/[id]/cancelar/route.ts`): confere dono
   do pedido e status atual antes de tentar o update; rate-limited.
3. **Banco** (`supabase/schema.sql`): a policy `orders_client_cancel`
   só libera o UPDATE se `status in ('novo','confirmado')` E só aceita
   o novo valor sendo `status = 'cancelado'`. Como RLS `with check` só
   valida o VALOR FINAL das colunas — não impede que o mesmo UPDATE
   altere outras colunas junto — existe também o trigger
   `orders_client_cancel_guard`, que rejeita qualquer update de não-admin
   que mude algo além de `status`.

Se for alterar essa regra de negócio (ex: permitir cancelar até
`em_producao`), tem que mudar as três camadas junto: a constante
`CANCELABLE_STATUSES` (existe duplicada em `conta/page.tsx` e na rota de
cancelamento — considere extrair para `src/lib/types.ts` se for mexer
nisso) e a policy no `schema.sql`.

## Preço e frete: nunca confiar no client

`src/app/api/checkout/route.ts` recebe do client só `product_id` +
`quantity`. Todo preço, frete e total são recalculados no servidor a
partir do banco (`getProductsByIds`) e da lógica de frete
(`src/lib/shipping.ts`, `src/lib/melhor-envio.ts`). Isso é intencional
e não deve ser "otimizado" para confiar em valores vindos do body da
requisição, mesmo que pareça redundante.

## Rate limiting

`src/lib/rate-limit.ts` é em memória, por processo — funciona para uma
loja pequena/média rodando em poucas instâncias, mas não é
distribuído (cada instância serverless tem seu próprio contador). Isso
está documentado no próprio arquivo. Se o tráfego crescer, migrar para
Upstash/Redis ou Vercel Firewall — não é um bug a "corrigir" sem que o
usuário peça, é uma limitação conhecida e aceita.

## Headers de segurança e CSP

`next.config.mjs` define CSP, HSTS, X-Frame-Options, nosniff,
Referrer-Policy e Permissions-Policy. A CSP usa `script-src 'unsafe-inline'`
porque o Next.js App Router precisa disso sem configuração de nonce
adicional — isso é uma concessão conhecida, não descuido. Se for
endurecer isso, precisa configurar nonce por request (`middleware.ts`
teria que injetar um nonce e propagá-lo), o que é uma mudança maior.

Qualquer novo domínio externo chamado pelo client (nova API de terceiro,
novo CDN de imagem etc.) PRECISA ser adicionado à CSP em
`next.config.mjs`, ou a chamada será bloqueada silenciosamente pelo
navegador em produção.

## Estrutura de pastas

```
src/
  app/
    admin/                painel administrativo (protegido, role=admin)
      produtos/            CRUD com upload de fotos
      pedidos/             gestão de pedidos + código PLN-DDMM-XXXX
    api/
      checkout/            cria o pedido (preços recalculados no servidor)
      frete/                cotação Correios via Melhor Envio
      pedidos/[id]/cancelar cliente cancela o próprio pedido (novo)
      admin/                rotas protegidas do painel
    conta/                  perfil + histórico/cancelamento de pedidos do cliente
    checkout/               formulário + confirmação instantânea (sem hold-to-confirm)
    login/ cadastro/        autenticação
    esqueci-senha/          recuperação de senha
    redefinir-senha/        destino do link de recuperação
  components/
    admin/                  ProductForm (upload), OrderStatusForm,
                            DashboardCharts, RealtimeOrdersNotifier
    Header.tsx              nav + estado de sessão + isAdmin (lê profiles.role)
  lib/
    supabase/               clients (browser, server, middleware) — padrão @supabase/ssr
    orders.ts               CRUD de pedidos, incluindo getOrdersForUser (usado em /conta)
    auth.ts                 requireAdmin() — segunda camada de proteção admin em rotas de API
    whatsapp.ts              monta a mensagem/URL wa.me do pedido
    order-code.ts            gera o código PLN-DDMM-XXXX
    validate-product.ts     validação de runtime do admin
    rate-limit.ts            rate limiting básico por IP, em memória
    shipping.ts              cálculo/labels de frete (retirada, entrega própria, Uber Flash, Correios)
    melhor-envio.ts          integração real de cotação Correios
supabase/
  schema.sql                tabelas, RLS, triggers, Storage, seed — fonte de verdade do banco
```

## Convenções de código a manter

- Toda rota de API valida o corpo em runtime (não confia só em tipagem
  TypeScript, que não existe depois do build) — ver o padrão de função
  `validate()` em `src/app/api/checkout/route.ts` como referência.
- IDs vindos de rota dinâmica (`[id]`) sempre validados por regex UUID
  antes de tocar o banco.
- Comentários em português, no mesmo estilo direto e técnico já usado no
  código — não trocar para inglês nem florear.
- RLS é a defesa de última linha, mas o código de aplicação também deve
  se comportar como se RLS não existisse (checagens explícitas em cada
  rota) — é assim que o projeto já é escrito, manter o padrão.

## Antes de declarar algo "corrigido" ou "implementado"

Rode `npx tsc --noEmit` e, se possível, `npm run build`. Este projeto já
passou por rodadas anteriores onde funcionalidades foram descritas como
prontas (ex: Mercado Pago) e depois removidas — evite reintroduzir
suposições de sessões passadas sem confirmar contra o código real deste
zip. Se a memória de conversa mencionar algo que não existe nos arquivos
atuais, o código manda, não a memória.
