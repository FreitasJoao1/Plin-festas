# Relatório Final — Plin Designs

`npm run typecheck` limpo. Nenhuma credencial aparece neste relatório,
no README ou em qualquer arquivo do zip — todas ficam exclusivamente em
`.env.local`, que está no `.gitignore` e nunca deve ser commitado.

---

## 1. INTEGRAÇÃO COM SUPABASE

Credenciais configuradas em `.env.local`. **Ação que só você pode
fazer** (meu ambiente não tem acesso de rede ao seu projeto):

1. Abra `https://supabase.com/dashboard/project/pprbiwlqrxmwriwlliaa/sql/new`
2. Cole o conteúdo INTEIRO de `supabase/schema.sql` e clique em "Run"
   → cria tabelas, RLS, bucket de Storage, Realtime, e os 39 produtos reais
3. Cadastre-se pelo site em `/cadastro`
4. No SQL Editor, rode:
   ```sql
   update public.profiles set role = 'admin'
   where id = (select id from auth.users where email = 'seu-email@aqui.com');
   ```
5. Login em `/login` → acesse `/admin`

*(Detalhes completos e o passo a passo de deploy estão no `README.md`.)*

---

## 2. RECURSOS DO SUPABASE EM USO

Conforme pedido — "use todos os adereços disponíveis pela Supabase":

| Recurso | Onde |
|---|---|
| **Auth** (login/senha) | `/login`, `/cadastro` |
| **Confirmação de e-mail** | Automática no cadastro |
| **Recuperação de senha** | `/esqueci-senha` + `/redefinir-senha` (novo) |
| **Trigger de banco** (`handle_new_user`) | Cria `profiles` automaticamente no cadastro |
| **Row Level Security** | Em `profiles`, `products`, `orders` e no bucket de Storage |
| **Storage** | Bucket `product-images` — upload real de fotos no admin |
| **Realtime** | Notificação ao vivo de pedido novo no painel admin (novo) |
| **Server-Side Rendering** (`@supabase/ssr`) | Clients de browser/server/middleware seguindo o padrão oficial |

---

## 3. FUNCIONALIDADES NOVAS NESTA RODADA

- **Esqueci minha senha** e **Redefinir senha** — fluxo completo
- **Saudação do cliente logado** no header: "Olá, [nome]! Como posso te
  ajudar hoje?" com gradiente da marca
- **Upload real de fotos** no CRUD de produtos (antes era só colar URL)
- **Dashboard com 4 gráficos reais** (recharts): receita por dia, pedidos
  por status, pedidos por dia, produtos mais pedidos
- **Notificação em tempo real** de pedido novo no admin (Supabase Realtime)
- **Logo maior** (h-9 → h-14/h-16) e com as cores hex exatas da marca, em
  todo lugar (header, footer, admin — antes só o header tinha a logo SVG)
- **Hover rosa→lilás** padronizado em todos os botões principais do site
  e do admin
- **ProductCard mais vivo**: hover levanta o card, botão muda de cor,
  feedback "Adicionado! ✓" ao clicar, badge de pedido mínimo

---

## 4. SEGURANÇA — TUDO QUE FOI CORRIGIDO

| Onde | Problema | Correção |
|---|---|---|
| `/api/checkout` | Sem validação de runtime (quantidade negativa/absurda aceita, JSON malformado derrubava a rota) | Validação completa + `try/catch` |
| `/api/checkout` | Sem proteção contra flood | Rate limit: 8 pedidos/min por IP |
| `/api/frete` | CEP e itens não validados, sem proteção contra flood | Regex de CEP, limite de itens, rate limit 20/min por IP |
| `/api/admin/produtos` (criar/editar) | Sem validação de preço, categoria, slug, imagens | Validador dedicado (`validate-product.ts`) |
| `/api/admin/produtos/[id]`, `/api/admin/pedidos/[id]` | ID da URL não validado antes do banco | Checagem de formato UUID |
| Upload de fotos | Sem limite de tamanho/tipo | 5MB máx., só JPG/PNG/WEBP/GIF — validado no client **e** no bucket (defesa em profundidade) |
| `next.config.mjs` | Sem headers de segurança | `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| Cadastro/redefinição de senha | Mínimo 6 caracteres | Elevado para 8 |
| `mercadopago` (pacote npm) | Dependência morta, superfície de ataque à toa | Removida |
| `/checkout/sucesso`, `/checkout/erro`, `/api/webhook/mercadopago`, `lib/mercadopago.ts` | Código órfão do fluxo antigo de pagamento | Removidos |
| `profiles` (RLS) | — | Policy impede cliente se autopromover a admin |
| Storage | — | RLS do bucket: leitura pública, escrita só admin |

**Limitação conhecida e documentada**: o rate-limiting é em memória
(por instância do servidor). Funciona bem para o volume de uma loja
pequena/média, mas se o tráfego crescer muito, o ideal é migrar para um
rate-limiter de borda (Vercel Firewall) ou com Redis — deixei isso
comentado no código (`src/lib/rate-limit.ts`) para quando for relevante.

---

## 5. ESTRUTURA GERAL (para referência)

- Checkout finaliza via **WhatsApp** com código de pedido `PLN-DDMM-XXXX`
- Painel admin: dashboard com gráficos, CRUD de produtos com fotos,
  gestão de pedidos com todos os detalhes e troca de status
- Site público: Home, catálogo por categoria, página de produto,
  checkout, conta do cliente, login/cadastro/recuperação de senha

---

## Como testar agora

```bash
npm install
npm run dev
```

Sem rodar o `schema.sql` ainda, o site funciona em modo demo (dados
mock, sem persistência). Depois de rodar o SQL e configurar o `.env.local`
(já feito), tudo passa a ser real: cadastro, login, produtos, pedidos,
fotos, gráficos.
