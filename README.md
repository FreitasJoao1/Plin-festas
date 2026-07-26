# Plin Designs

Site de e-commerce para bolsas, necessaires, copos e lembrancinhas
personalizadas em Salvador/BA. Next.js 14 (App Router) + TypeScript +
Tailwind + Supabase. O checkout finaliza via **WhatsApp** (sem gateway de
pagamento) — o cliente monta o pedido no site e é redirecionado com a
mensagem pronta para combinar com a loja.

O projeto roda em **modo demo** sem nenhuma variável de ambiente
configurada (catálogo mock, sem login) — dá pra clonar e rodar `npm run
dev` imediatamente. Com o Supabase configurado, tudo passa a persistir de
verdade: produtos, pedidos, contas de cliente e fotos.

## Stack

- **Next.js 14** (App Router, Server Components)
- **Supabase** — banco de dados (Postgres), autenticação, Storage de
  fotos, Realtime
- **Melhor Envio** — cotação de frete via Correios (opcional)
- **Zustand** — carrinho (persistido no localStorage do navegador)
- **Recharts** — gráficos do dashboard admin
- **Tailwind CSS** — estilos, com os tokens de marca em `tailwind.config.ts`

## Estrutura

```
src/
  app/
    admin/                painel administrativo (protegido, role=admin)
      produtos/            CRUD com upload de fotos
      pedidos/             gestão de pedidos + código PLN-DDMM-XXXX
    api/
      checkout/            cria o pedido (preços recalculados no servidor)
      frete/                cotação Correios via Melhor Envio
      admin/                rotas protegidas do painel
    conta/                  histórico de pedidos do cliente logado
    login/ cadastro/        autenticação
    esqueci-senha/          recuperação de senha
    redefinir-senha/        destino do link de recuperação
  components/
    admin/                  ProductForm (com upload), OrderStatusForm,
                            DashboardCharts, RealtimeOrdersNotifier
  lib/
    supabase/               clientes (browser, server, middleware)
    storage.ts              upload de fotos pro Supabase Storage
    whatsapp.ts              monta a mensagem do pedido
    order-code.ts            gera o código PLN-DDMM-XXXX
    validate-product.ts     validação de runtime do admin
    rate-limit.ts            rate limiting básico por IP
supabase/
  schema.sql                tabelas, RLS, Storage, Realtime, seed — rode
                            isso inteiro no SQL Editor do Supabase
```

## Rodando localmente

```bash
npm install
npm run dev
```

Abre em `http://localhost:3000`. Sem `.env.local`, roda em modo demo.

## Configurando o Supabase (obrigatório para produção)

### 1. Rodar o schema

1. Abra seu projeto em [supabase.com/dashboard](https://supabase.com/dashboard)
2. Vá em **SQL Editor → New query**
3. Cole o conteúdo inteiro de `supabase/schema.sql` e rode

Isso cria as tabelas, todas as RLS policies, o bucket de Storage para
fotos dos produtos (com limite de 5MB e tipos de arquivo restritos),
ativa o Realtime na tabela de pedidos, e já popula o catálogo com os
produtos reais da loja.

### 2. Variáveis de ambiente

Copie `.env.example` para `.env.local` e preencha:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_WHATSAPP_NUMBER=...
```

As chaves do Supabase ficam em **Project Settings → API Keys**.

### 3. Criar seu login de admin

1. Cadastre-se pelo site em `/cadastro` com o e-mail que vai administrar
   a loja
2. No SQL Editor do Supabase, rode (trocando o e-mail):
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'seu-email@aqui.com');
   ```
3. Faça login em `/login` e acesse `/admin`

### 4. Frete via Correios (opcional)

Sem isso, a opção "Correios" no checkout cai automaticamente para "frete
a combinar por WhatsApp". Para ativar, crie uma conta em
[melhorenvio.com.br](https://melhorenvio.com.br) e preencha
`MELHOR_ENVIO_TOKEN` e `MELHOR_ENVIO_CEP_ORIGEM`.

## Deploy (Vercel)

1. Suba o repositório para o GitHub (**privado** — o código tem lógica
   de negócio que não precisa ser pública)
2. Importe em [vercel.com](https://vercel.com)
3. Configure todas as variáveis do `.env.local` em **Project Settings →
   Environment Variables**
4. Preencha `NEXT_PUBLIC_SITE_URL` com a URL final do domínio

## Comandos disponíveis

```bash
npm run dev         # desenvolvimento
npm run build       # build de produção
npm run start       # roda o build de produção localmente
npm run lint        # eslint
npm run typecheck   # tsc --noEmit
```

## Segurança — o que já está em vigor

- **Preços e frete recalculados no servidor** no checkout — nunca confia
  no que o navegador envia
- **RLS (Row Level Security)** em todas as tabelas e no bucket de Storage
- **Admin protegido em duas camadas**: middleware bloqueia as páginas,
  cada rota de API confere `role=admin` de novo por conta própria
- **Cliente não consegue se autopromover a admin** — bloqueado na policy
  de UPDATE de `profiles`
- **Validação de runtime completa** em todas as rotas de API (não só
  tipagem TypeScript, que não existe em tempo de execução)
- **Rate limiting básico** por IP nas rotas de checkout e frete
- **Upload de imagens** restrito a admin, limitado a 5MB e tipos de
  imagem válidos, tanto no client quanto no bucket do Supabase
- **Headers de segurança HTTP** (anti-clickjacking, nosniff, referrer
  policy, permissions policy)
- **Senha mínima de 8 caracteres** em cadastro e redefinição
- Consulte `RELATORIO.md` para o histórico completo de correções

## Repositório privado

Este projeto deve ficar em um **repositório privado** no GitHub — mesmo
com `.env.local` no `.gitignore`, o código contém lógica de negócio
(regras de frete, preços, fluxo do WhatsApp) que não há motivo para
expor publicamente.
