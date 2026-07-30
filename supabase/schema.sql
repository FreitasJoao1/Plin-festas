-- ============================================================================
-- Plin Designs — schema completo do Supabase (v2)
--
-- Como rodar:
--   1. Abra https://supabase.com/dashboard/project/pprbiwlqrxmwriwlliaa
--   2. Vá em "SQL Editor" → "New query"
--   3. Cole este arquivo INTEIRO e clique em "Run"
--   4. Depois siga a SEÇÃO 7 no final para criar seu login de admin
--
-- Este script é seguro de rodar mais de uma vez (usa "if not exists" e
-- "on conflict" onde possível).
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABELAS
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null default '',
  phone text,
  role text not null default 'cliente' check (role in ('cliente', 'admin')),
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Perfil de cada usuário autenticado. role=admin dá acesso ao painel /admin.';

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  category text not null check (
    category in ('bolsas', 'necessaires', 'copos', 'lembrancinhas', 'chaveiros', 'outros')
  ),
  price_cents integer not null check (price_cents >= 0),
  compare_at_price_cents integer check (
    compare_at_price_cents is null or compare_at_price_cents >= 0
  ),
  min_order integer,
  stock integer not null default 99 check (stock >= 0),
  images text[] not null default '{}',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists products_category_idx on public.products (category);

-- Mínimo de pedido por VALOR (em centavos), independente do mínimo por
-- quantidade (min_order, coluna já existente acima). Ambos são opcionais e
-- podem coexistir no mesmo produto (ex: "mín. 10 un" E "mín. R$ 50,00").
alter table public.products
  add column if not exists min_order_value_cents integer
  check (min_order_value_cents is null or min_order_value_cents >= 0);

comment on column public.products.min_order is
  'Quantidade mínima por pedido para este produto (opcional). Editável em /admin/produtos.';
comment on column public.products.min_order_value_cents is
  'Valor mínimo em centavos por pedido para este produto (opcional). Editável em /admin/produtos.';
create index if not exists products_active_idx on public.products (active);
create index if not exists products_slug_idx on public.products (slug);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_code text not null unique,
  user_id uuid references auth.users (id) on delete set null,
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null default '',
  note text,
  items jsonb not null default '[]',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  shipping_method text not null check (
    shipping_method in ('retirada', 'entrega_propria', 'uber_flash', 'correios')
  ),
  shipping_city text check (shipping_city in ('salvador', 'lauro_de_freitas')),
  shipping_cents integer not null default 0 check (shipping_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  status text not null default 'novo' check (
    status in ('novo', 'confirmado', 'em_producao', 'pronto', 'enviado', 'entregue', 'cancelado')
  ),
  -- Módulo de agendamento (capacity planning) — independente do status de
  -- produção acima. booking_date é a data que o cliente pediu para o
  -- evento/entrega; booking_status controla a aprovação da loja para essa
  -- data específica (não confundir com o andamento da produção em si).
  booking_date date,
  booking_status text not null default 'pending_approval' check (
    booking_status in ('pending_approval', 'approved', 'rejected')
  ),
  booking_rejection_reason text,
  booking_alternative_date date,
  -- Sem gateway de pagamento OBRIGATÓRIO neste projeto — o WhatsApp
  -- continua sendo a forma padrão de fechar pedido. InfinitePay (abaixo)
  -- é uma opção EXTRA de pagamento online, não substitui o WhatsApp.
  -- refund_status é uma flag operacional: quando a loja recusa uma data
  -- já paga (seja por fora via Pix manual, seja via InfinitePay), isso
  -- vira uma tarefa manual para o admin resolver o estorno.
  refund_status text not null default 'none' check (
    refund_status in ('none', 'refund_pending', 'refunded')
  ),
  -- Pagamento via InfinitePay Checkout — opcional, paralelo ao WhatsApp.
  -- payment_status é OTIMISTA no navegador (a redirect_url do checkout já
  -- indica sucesso) mas só vira 'paid' de verdade depois que o SERVIDOR
  -- confirma via payment_check ou webhook (nunca confiamos só no client
  -- dizendo "paguei"). Ver src/lib/infinitepay.ts.
  payment_status text not null default 'none' check (
    payment_status in ('none', 'pending', 'paid', 'failed')
  ),
  payment_method text check (payment_method in ('pix', 'credit_card')),
  -- Identificadores da InfinitePay, usados para conferir o pagamento
  -- depois (payment_check) sem confiar no que o client ou o webhook dizem.
  infinitepay_order_nsu text,
  infinitepay_transaction_nsu text,
  infinitepay_invoice_slug text,
  infinitepay_paid_amount_cents integer,
  created_at timestamptz not null default now()
);

-- IMPORTANTE: "create table if not exists" acima só roda se a tabela
-- ainda não existir — se `orders` já existia de uma versão anterior do
-- projeto (antes de booking_date/pagamento existirem neste schema), as
-- colunas novas NUNCA são criadas só por rodar o script de novo, mesmo
-- que pareça "seguro de rodar mais de uma vez". O bloco abaixo corrige
-- isso agora e protege contra o mesmo problema em qualquer coluna futura:
-- roda sempre, independente da tabela já existir ou não, e cada linha é
-- individualmente no-op se a coluna já existir.
alter table public.orders add column if not exists booking_date date;
alter table public.orders add column if not exists booking_status text not null default 'pending_approval';
alter table public.orders add column if not exists booking_rejection_reason text;
alter table public.orders add column if not exists booking_alternative_date date;
alter table public.orders add column if not exists refund_status text not null default 'none';
alter table public.orders add column if not exists payment_status text not null default 'none';
alter table public.orders add column if not exists payment_method text;
alter table public.orders add column if not exists infinitepay_order_nsu text;
alter table public.orders add column if not exists infinitepay_transaction_nsu text;
alter table public.orders add column if not exists infinitepay_invoice_slug text;
alter table public.orders add column if not exists infinitepay_paid_amount_cents integer;

-- As constraints "check" também são "if not exists" implícitas por nome,
-- então recriamos com nome fixo + "drop if exists" antes, pelo mesmo
-- motivo: se a coluna foi adicionada agora pelo ALTER acima, ela ainda
-- não tem a validação de valores permitidos.
alter table public.orders drop constraint if exists orders_booking_status_check;
alter table public.orders add constraint orders_booking_status_check
  check (booking_status in ('pending_approval', 'approved', 'rejected'));

alter table public.orders drop constraint if exists orders_refund_status_check;
alter table public.orders add constraint orders_refund_status_check
  check (refund_status in ('none', 'refund_pending', 'refunded'));

alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check
  check (payment_status in ('none', 'pending', 'paid', 'failed'));

alter table public.orders drop constraint if exists orders_payment_method_check;
alter table public.orders add constraint orders_payment_method_check
  check (payment_method is null or payment_method in ('pix', 'credit_card'));

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_order_code_idx on public.orders (order_code);
create index if not exists orders_booking_date_idx on public.orders (booking_date);
create index if not exists orders_booking_status_idx on public.orders (booking_status);
create unique index if not exists orders_infinitepay_order_nsu_idx
  on public.orders (infinitepay_order_nsu) where infinitepay_order_nsu is not null;

-- ============================================================================
-- 2. FUNÇÃO AUXILIAR: is_admin()
-- ============================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- ============================================================================
-- 3. TRIGGER: cria o profile automaticamente no cadastro
-- ============================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone',
    'cliente'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;

drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
  on public.profiles for select
  using (auth.uid() = id or public.is_admin());

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = 'cliente');

drop policy if exists "profiles_admin_manage" on public.profiles;
create policy "profiles_admin_manage"
  on public.profiles for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "products_public_read_active" on public.products;
create policy "products_public_read_active"
  on public.products for select
  using (active = true);

drop policy if exists "products_admin_manage" on public.products;
create policy "products_admin_manage"
  on public.products for all
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "orders_select_own_or_admin" on public.orders;
create policy "orders_select_own_or_admin"
  on public.orders for select
  using (auth.uid() = user_id or public.is_admin());

-- Checkout funciona sem login (o pedido vira mensagem de WhatsApp, então
-- não há dado sensível de pagamento em jogo). Os valores já foram
-- recalculados no servidor (src/app/api/checkout/route.ts) antes de
-- chegar aqui.
drop policy if exists "orders_insert_anyone" on public.orders;
create policy "orders_insert_anyone"
  on public.orders for insert
  with check (true);

drop policy if exists "orders_admin_update" on public.orders;
create policy "orders_admin_update"
  on public.orders for update
  using (public.is_admin())
  with check (public.is_admin());

-- Cliente pode cancelar o PRÓPRIO pedido, mas só enquanto ele ainda não
-- entrou em produção/foi concluído. A cláusula "using" trava quais linhas
-- podem ser tocadas (dono + status atual ainda cancelável); o "with check"
-- trava o que a linha pode virar depois do update (só 'cancelado').
drop policy if exists "orders_client_cancel" on public.orders;
create policy "orders_client_cancel"
  on public.orders for update
  using (
    auth.uid() = user_id
    and status in ('novo', 'confirmado')
  )
  with check (
    auth.uid() = user_id
    and status = 'cancelado'
  );

-- RLS "with check" só valida o VALOR FINAL das colunas, não impede que o
-- mesmo UPDATE altere outras colunas (total_cents, items etc.) junto com o
-- status. Este trigger fecha essa brecha: se quem está fazendo o update
-- não é admin, qualquer alteração fora de "status" é rejeitada. Isso
-- protege mesmo que alguém tente chamar o Supabase direto do navegador,
-- pulando a rota /api/pedidos/[id]/cancelar.
-- Chamadas com a service_role key (webhook/payment_check da InfinitePay,
-- em src/lib/orders.ts) rodam sem sessão de usuário — auth.uid() vem
-- NULL nesse caso, não "admin". O trigger abaixo trata isso como
-- "sistema", e é o único caso, além de admin, que pode alterar campos de
-- pagamento.
--
-- Isso é seguro porque RLS roda ANTES deste trigger: um visitante
-- anônimo (anon key, auth.uid() também null) nunca chega até aqui, pois
-- nenhuma policy de UPDATE em orders libera update para quem não é dono
-- do pedido (orders_client_cancel exige auth.uid() = user_id) nem admin
-- (orders_admin_update exige is_admin()) — sem policy que libere, o
-- Postgres rejeita o UPDATE antes do trigger sequer rodar. A única forma
-- de auth.uid() ser null E o UPDATE chegar até aqui é via service_role,
-- que ignora RLS mas não este trigger.
create or replace function public.enforce_client_cancel_only_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    return new;
  end if;

  -- Chamada via service_role (sistema, ex: webhook de pagamento): permite
  -- alterar SÓ os campos de pagamento, nada mais.
  if auth.uid() is null then
    if (
      new.order_code, new.user_id, new.customer_name, new.customer_phone,
      new.customer_email, new.note, new.items, new.subtotal_cents,
      new.shipping_method, new.shipping_city, new.shipping_cents,
      new.total_cents, new.created_at, new.status,
      new.booking_date, new.booking_status, new.booking_rejection_reason,
      new.booking_alternative_date, new.refund_status
    ) is distinct from (
      old.order_code, old.user_id, old.customer_name, old.customer_phone,
      old.customer_email, old.note, old.items, old.subtotal_cents,
      old.shipping_method, old.shipping_city, old.shipping_cents,
      old.total_cents, old.created_at, old.status,
      old.booking_date, old.booking_status, old.booking_rejection_reason,
      old.booking_alternative_date, old.refund_status
    ) then
      raise exception 'Chamada de sistema só pode alterar campos de pagamento.';
    end if;
    return new;
  end if;

  if (
    new.order_code, new.user_id, new.customer_name, new.customer_phone,
    new.customer_email, new.note, new.items, new.subtotal_cents,
    new.shipping_method, new.shipping_city, new.shipping_cents,
    new.total_cents, new.created_at
  ) is distinct from (
    old.order_code, old.user_id, old.customer_name, old.customer_phone,
    old.customer_email, old.note, old.items, old.subtotal_cents,
    old.shipping_method, old.shipping_city, old.shipping_cents,
    old.total_cents, old.created_at
  ) then
    raise exception 'Apenas o status do pedido pode ser alterado pelo cliente.';
  end if;

  return new;
end;
$$;

drop trigger if exists orders_client_cancel_guard on public.orders;
create trigger orders_client_cancel_guard
  before update on public.orders
  for each row execute function public.enforce_client_cancel_only_status();

-- ============================================================================
-- 4b. MÓDULO DE AGENDAMENTO — capacidade semanal e horizonte de 60 dias
-- ============================================================================

-- Cota semanal configurável sem precisar editar código/trigger. Uma linha
-- só, sempre id=1. Se quiser cotas diferentes por período do ano, isso
-- precisaria virar uma tabela por semana — fora de escopo por ora.
create table if not exists public.booking_settings (
  id integer primary key default 1 check (id = 1),
  weekly_capacity integer not null default 20 check (weekly_capacity > 0),
  horizon_days integer not null default 180 check (horizon_days > 0)
);
insert into public.booking_settings (id) values (1) on conflict (id) do nothing;

-- Garante que uma linha já existente (criada antes desta atualização, com
-- o valor antigo de 60 dias) também passa a usar o novo horizonte de 180
-- dias. Sem este UPDATE, só bancos novos ganhariam o valor — bancos que já
-- rodaram o schema.sql antes ficariam presos em 60 pelo "on conflict do
-- nothing" acima.
update public.booking_settings set horizon_days = 180 where id = 1 and horizon_days = 60;

alter table public.booking_settings enable row level security;
drop policy if exists "booking_settings_public_read" on public.booking_settings;
create policy "booking_settings_public_read"
  on public.booking_settings for select
  using (true);
drop policy if exists "booking_settings_admin_write" on public.booking_settings;
create policy "booking_settings_admin_write"
  on public.booking_settings for all
  using (public.is_admin())
  with check (public.is_admin());

-- Conta quantos pedidos já ocupam a semana de uma data (segunda a domingo),
-- contando só pedidos com booking_status IN ('pending_approval','approved')
-- e status <> 'cancelado' — pedido recusado ou cancelado libera a vaga.
create or replace function public.booking_week_occupancy(p_date date)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from public.orders
  where booking_date is not null
    and booking_date >= date_trunc('week', p_date::timestamp)::date
    and booking_date < (date_trunc('week', p_date::timestamp)::date + 7)
    and booking_status in ('pending_approval', 'approved')
    and status <> 'cancelado';
$$;

-- Valida, no servidor, TUDO que a UI já devia impedir: horizonte máximo,
-- data no passado, e cota semanal. Isso roda em qualquer INSERT/UPDATE
-- que define/altera booking_date, então nenhuma rota de API (nem uma
-- futura, nem um bug) consegue criar um agendamento fora das regras
-- só porque esqueceu de checar no código da aplicação.
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings record;
  v_occupancy integer;
begin
  if new.booking_date is null then
    return new;
  end if;

  -- Se a data de agendamento não mudou, e o status de agendamento também
  -- não, não precisa revalidar (evita re-contar a própria linha em updates
  -- que não mexem em agendamento, ex: admin avançando status de produção).
  if TG_OP = 'UPDATE'
     and new.booking_date is not distinct from old.booking_date
     and new.booking_status is not distinct from old.booking_status
  then
    return new;
  end if;

  select * into v_settings from public.booking_settings where id = 1;

  if new.booking_date < current_date then
    raise exception 'Data de agendamento não pode ser no passado.';
  end if;

  if new.booking_date > current_date + v_settings.horizon_days then
    raise exception 'Data de agendamento além do horizonte máximo de % dias.', v_settings.horizon_days;
  end if;

  if new.booking_status in ('pending_approval', 'approved') and new.status <> 'cancelado' then
    -- Exclui a própria linha da contagem em updates (senão um pedido
    -- já aprovado se autobloquearia ao ser salvo de novo).
    select count(*)::integer into v_occupancy
    from public.orders
    where booking_date is not null
      and booking_date >= date_trunc('week', new.booking_date::timestamp)::date
      and booking_date < (date_trunc('week', new.booking_date::timestamp)::date + 7)
      and booking_status in ('pending_approval', 'approved')
      and status <> 'cancelado'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if v_occupancy >= v_settings.weekly_capacity then
      raise exception 'Semana sem vagas disponíveis (capacidade de % pedidos atingida).', v_settings.weekly_capacity;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_booking_capacity_guard on public.orders;
create trigger orders_booking_capacity_guard
  before insert or update on public.orders
  for each row execute function public.enforce_booking_capacity();

-- ============================================================================
-- 4c. SOBRESCRITA DE AGENDA — cota por semana específica + status por dia
-- ============================================================================

-- Sobrescreve weekly_capacity só para semanas específicas (ex: semana de
-- Natal com cota maior). Ausência de linha = usa o padrão global.
create table if not exists public.week_capacity_overrides (
  week_start date primary key,
  capacity integer not null check (capacity > 0),
  updated_at timestamptz not null default now()
);

alter table public.week_capacity_overrides enable row level security;
drop policy if exists "week_capacity_overrides_public_read" on public.week_capacity_overrides;
create policy "week_capacity_overrides_public_read"
  on public.week_capacity_overrides for select
  using (true);
drop policy if exists "week_capacity_overrides_admin_write" on public.week_capacity_overrides;
create policy "week_capacity_overrides_admin_write"
  on public.week_capacity_overrides for all
  using (public.is_admin())
  with check (public.is_admin());

-- Status manual de um dia específico, independente da ocupação calculada.
-- 'available' = comportamento normal (calculado pela ocupação da semana).
-- 'limited'   = força a aparência de "vagas limitadas" mesmo com ocupação baixa.
-- 'full'      = força esgotado — bloqueia o dia no checkout mesmo com vaga na semana.
-- 'blocked'   = fora de serviço (feriado, sem produção) — mesmo efeito de bloqueio que 'full'.
create table if not exists public.day_status_overrides (
  date date primary key,
  status text not null check (status in ('available', 'limited', 'full', 'blocked')),
  updated_at timestamptz not null default now()
);

alter table public.day_status_overrides enable row level security;
drop policy if exists "day_status_overrides_public_read" on public.day_status_overrides;
create policy "day_status_overrides_public_read"
  on public.day_status_overrides for select
  using (true);
drop policy if exists "day_status_overrides_admin_write" on public.day_status_overrides;
create policy "day_status_overrides_admin_write"
  on public.day_status_overrides for all
  using (public.is_admin())
  with check (public.is_admin());

-- Retorna a cota efetiva de uma semana: override se existir, senão o padrão global.
create or replace function public.effective_week_capacity(p_week_start date)
returns integer
language sql
stable
as $$
  select coalesce(
    (select capacity from public.week_capacity_overrides where week_start = p_week_start),
    (select weekly_capacity from public.booking_settings where id = 1)
  );
$$;

-- Substitui a função de capacidade para também considerar cota por semana
-- (override) e bloqueio manual do dia ('full'/'blocked' impedem o agendamento
-- mesmo que a semana ainda tenha vaga).
create or replace function public.enforce_booking_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_settings record;
  v_week_start date;
  v_effective_capacity integer;
  v_day_status text;
  v_occupancy integer;
begin
  if new.booking_date is null then
    return new;
  end if;

  if TG_OP = 'UPDATE'
     and new.booking_date is not distinct from old.booking_date
     and new.booking_status is not distinct from old.booking_status
  then
    return new;
  end if;

  select * into v_settings from public.booking_settings where id = 1;

  if new.booking_date < current_date then
    raise exception 'Data de agendamento não pode ser no passado.';
  end if;

  if new.booking_date > current_date + v_settings.horizon_days then
    raise exception 'Data de agendamento além do horizonte máximo de % dias.', v_settings.horizon_days;
  end if;

  if new.booking_status in ('pending_approval', 'approved') and new.status <> 'cancelado' then
    select status into v_day_status
    from public.day_status_overrides
    where date = new.booking_date;

    if v_day_status in ('full', 'blocked') then
      raise exception 'Data indisponível para agendamento (bloqueada pelo administrador).';
    end if;

    v_week_start := new.booking_date - (extract(isodow from new.booking_date)::integer - 1);
    v_effective_capacity := public.effective_week_capacity(v_week_start);

    select count(*)::integer into v_occupancy
    from public.orders
    where booking_date is not null
      and booking_date >= v_week_start
      and booking_date < (v_week_start + 7)
      and booking_status in ('pending_approval', 'approved')
      and status <> 'cancelado'
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

    if v_occupancy >= v_effective_capacity then
      raise exception 'Semana sem vagas disponíveis (capacidade de % pedidos atingida).', v_effective_capacity;
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- 4d. CUPONS DE DESCONTO
-- ============================================================================
-- Cupom aplicado pelo cliente no checkout (campo "cupom de desconto").
-- O desconto pode valer para TODO o carrinho, só para uma categoria
-- (classe) de produto, ou só para uma lista específica de produtos —
-- controlado pela coluna `scope` + `scope_category`/`scope_product_ids`.
-- `min_order_value_cents`, quando definido, é o valor mínimo (em centavos)
-- dos itens ELEGÍVEIS ao cupom (não do carrinho inteiro) para o desconto
-- valer — ex: "cupom só vale se levar R$ 100 em bolsas".
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  description text not null default '',
  discount_type text not null check (discount_type in ('percentage', 'fixed')),
  -- Para 'percentage': número inteiro de 1 a 100 (%).
  -- Para 'fixed': valor em centavos, maior que zero.
  discount_value integer not null check (discount_value > 0),
  -- 'all' = aplica no subtotal inteiro do carrinho.
  -- 'category' = aplica só nos itens da categoria em scope_category.
  -- 'products' = aplica só nos itens cujo product_id está em scope_product_ids.
  scope text not null default 'all' check (scope in ('all', 'category', 'products')),
  scope_category text check (
    scope_category is null or scope_category in
      ('bolsas', 'necessaires', 'copos', 'lembrancinhas', 'chaveiros', 'outros')
  ),
  scope_product_ids uuid[] not null default '{}',
  -- Valor mínimo (centavos) dos itens elegíveis para o cupom valer. NULL = sem mínimo.
  min_order_value_cents integer check (min_order_value_cents is null or min_order_value_cents >= 0),
  -- Limite de quantas vezes o cupom pode ser usado no total. NULL = ilimitado.
  max_uses integer check (max_uses is null or max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  active boolean not null default true,
  valid_from timestamptz,
  valid_until timestamptz,
  created_at timestamptz not null default now()
);

comment on table public.coupons is
  'Cupons de desconto aplicáveis no checkout. Gerenciados em /admin/cupons.';
comment on column public.coupons.discount_value is
  'Percentual (1-100) se discount_type=percentage, ou centavos se discount_type=fixed.';
comment on column public.coupons.min_order_value_cents is
  'Valor mínimo, em centavos, dos itens elegíveis ao cupom (não do carrinho todo) para o desconto valer.';

create index if not exists coupons_code_idx on public.coupons (upper(code));
create index if not exists coupons_active_idx on public.coupons (active);

alter table public.coupons enable row level security;

-- Sem policy de leitura pública de propósito: se qualquer pessoa pudesse
-- fazer SELECT * na tabela via anon key, ela listaria TODOS os códigos de
-- cupom ativos (mesmo os que não foram divulgados), o que anula o
-- propósito de um cupom "secreto". A validação de cupom no checkout roda
-- em src/app/api/cupom/validar/route.ts usando a service_role key
-- (createServiceRoleClient), que ignora RLS — o mesmo padrão já usado
-- para consultar pedidos por código no webhook de pagamento.
drop policy if exists "coupons_admin_manage" on public.coupons;
create policy "coupons_admin_manage"
  on public.coupons for all
  using (public.is_admin())
  with check (public.is_admin());

-- Incrementa o contador de uso do cupom de forma atômica (evita race
-- condition de dois checkouts simultâneos lendo o mesmo used_count e
-- sobrescrevendo um ao outro com um UPDATE ... SET used_count = X).
-- security definer porque é chamada via service_role a partir do checkout
-- público (sem sessão de admin) — ver src/lib/coupons.ts.
create or replace function public.increment_coupon_usage(p_coupon_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.coupons set used_count = used_count + 1 where id = p_coupon_id;
$$;

-- Pedido carrega o cupom aplicado (se houve) e o desconto já calculado e
-- validado no servidor — nunca confiamos em desconto calculado no client.
alter table public.orders add column if not exists coupon_code text;
alter table public.orders add column if not exists discount_cents integer not null default 0;
alter table public.orders drop constraint if exists orders_discount_cents_check;
alter table public.orders add constraint orders_discount_cents_check
  check (discount_cents >= 0);

-- ============================================================================
-- 5. STORAGE — bucket público para fotos dos produtos
-- ============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images', 'product-images', true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Qualquer pessoa pode VER as imagens (bucket público, necessário pra
-- aparecer no site). Só admin pode enviar/editar/excluir.
drop policy if exists "product_images_public_read" on storage.objects;
create policy "product_images_public_read"
  on storage.objects for select
  using (bucket_id = 'product-images');

drop policy if exists "product_images_admin_write" on storage.objects;
create policy "product_images_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_update" on storage.objects;
create policy "product_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'product-images' and public.is_admin());

drop policy if exists "product_images_admin_delete" on storage.objects;
create policy "product_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'product-images' and public.is_admin());

-- Bucket separado para fotos dos blocos editáveis da home (hero etc.) —
-- mesmas regras de acesso do bucket de produtos, mas mantido à parte para
-- não misturar imagens de catálogo com imagens de apresentação do site.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-content', 'site-content', true,
  5242880, -- 5MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "site_content_images_public_read" on storage.objects;
create policy "site_content_images_public_read"
  on storage.objects for select
  using (bucket_id = 'site-content');

drop policy if exists "site_content_images_admin_write" on storage.objects;
create policy "site_content_images_admin_write"
  on storage.objects for insert
  with check (bucket_id = 'site-content' and public.is_admin());

drop policy if exists "site_content_images_admin_update" on storage.objects;
create policy "site_content_images_admin_update"
  on storage.objects for update
  using (bucket_id = 'site-content' and public.is_admin());

drop policy if exists "site_content_images_admin_delete" on storage.objects;
create policy "site_content_images_admin_delete"
  on storage.objects for delete
  using (bucket_id = 'site-content' and public.is_admin());

-- ============================================================================
-- 6. CATÁLOGO REAL — os 39 produtos do @plindesign_
-- ============================================================================
insert into public.products (slug, name, description, category, price_cents, compare_at_price_cents, min_order, stock, images, active)
values
  ('frasqueira-quadrada', 'Frasqueira Quadrada', 'Frasqueira personalizada com tema à escolha. Material resistente, acabamento perfeito.', 'bolsas', 1000, null, null, 99, array['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80'], true),
  ('mochilinha-slim', 'Mochilinha Slim', 'Mochilinha infantil personalizada, leve e resistente. Tema à escolha.', 'bolsas', 1200, null, null, 99, array['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'], true),
  ('bolsa-bau-midi', 'Bolsa Báu Midi', 'Bolsa no formato báu, personalizada com tema à escolha.', 'bolsas', 1600, null, null, 99, array['https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=800&q=80'], true),
  ('bolsa-bau-g', 'Bolsa Báu G', 'Versão grande da Bolsa Báu.', 'bolsas', 2000, null, 10, 99, array['https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&q=80'], true),
  ('bolsa-trapezio-transparente', 'Bolsa Trapézio com Transparente', 'Bolsa no formato trapézio com visor transparente, personalizada.', 'bolsas', 1400, null, null, 99, array['https://images.unsplash.com/photo-1591561954555-607968c989ab?w=800&q=80'], true),
  ('bolsinha-bolear', 'Bolsinha Bolear', 'Bolsinha redonda em formato de bola, personalizada com tema à escolha.', 'bolsas', 800, null, null, 99, array['https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?w=800&q=80'], true),
  ('maletinha', 'Maletinha', 'Maletinha personalizada, ideal para lembrancinha de festa.', 'bolsas', 800, null, null, 99, array['https://images.unsplash.com/photo-1594938298603-c8148c4b4283?w=800&q=80'], true),
  ('meia-lua-3d', 'Meia Lua 3D', 'Bolsa meia-lua 3D personalizada, tema à escolha.', 'bolsas', 1150, null, null, 99, array['https://images.unsplash.com/photo-1614179924047-e1ab49a0a0cf?w=800&q=80'], true),
  ('bag-click', 'Bag Click', 'Bag com fechamento click, personalizada com seu tema.', 'bolsas', 1000, null, null, 99, array['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80'], true),
  ('bolsa-dora-lateral', 'Bolsa Dora Lateral', 'Bolsa no formato Dora, personalizada. Tema à escolha.', 'bolsas', 1200, null, null, 99, array['https://images.unsplash.com/photo-1601924994987-69e26d50dc26?w=800&q=80'], true),
  ('mochila-saco-personalizada', 'Mochila Saco Personalizada', 'Mochila saco 20x27cm, personalizada com tema à escolha.', 'bolsas', 600, null, null, 99, array['https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&q=80'], true),
  ('necessaire-simples', 'Necessaire Simples', 'Personalizada frente e verso. Tema à escolha.', 'necessaires', 700, null, null, 99, array['https://images.unsplash.com/photo-1556742044-3c52d6e88c62?w=800&q=80'], true),
  ('necessaire-box', 'Necessaire Box Personalizada', 'Tamanho 14x20cm, personalizada. Tema à escolha.', 'necessaires', 1000, null, null, 99, array['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80'], true),
  ('estojo-personalizado', 'Estojo Personalizado', 'Personaliza da forma que desejar. Tema à escolha.', 'necessaires', 1500, null, null, 99, array['https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80'], true),
  ('estojo-super', 'Estojo Super', 'Personalizado com tema à escolha.', 'necessaires', 850, null, 10, 99, array['https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=800&q=80'], true),
  ('quadrangular-17x17', 'Quadrangular 17x17', 'Necessaire quadrada 17x17cm, personalizada com tema à escolha.', 'necessaires', 1000, null, null, 99, array['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80'], true),
  ('frasqueira-redonda', 'Frasqueira Redonda', 'Frasqueira no formato redondo, personalizada com tema à escolha.', 'necessaires', 1400, null, null, 99, array['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80'], true),
  ('retangular-com-visor', 'Retangular com Visor', 'Necessaire retangular com visor transparente.', 'necessaires', 1200, null, 10, 99, array['https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=800&q=80'], true),
  ('retangular-com-2-visor', 'Retangular com 2 Visores', 'Necessaire com 2 visores transparentes.', 'necessaires', 1400, null, 10, 99, array['https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=800&q=80'], true),
  ('mini-ecobag-cristal', 'Mini Ecobag Cristal', 'Ecobag mini em material cristal, personalizada.', 'necessaires', 790, null, null, 99, array['https://images.unsplash.com/photo-1590874103328-eac38a683ce7?w=800&q=80'], true),
  ('meia-bag-slim', 'Meia Bag Slim', 'Bag slim meia-lua, personalizada com tema à escolha.', 'necessaires', 750, null, null, 99, array['https://images.unsplash.com/photo-1614179924047-e1ab49a0a0cf?w=800&q=80'], true),
  ('copo-twister-com-canudo', 'Copo Twister com Canudo', 'Personalizado.', 'copos', 500, null, 10, 99, array['https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80'], true),
  ('caneca-personalizada', 'Caneca Personalizada 325ml', 'Caneca 325ml personalizada. Tema à escolha.', 'copos', 4000, null, null, 99, array['https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=800&q=80'], true),
  ('caneca-acrilica-300ml', 'Caneca Acrílica 300ml', 'Personalização apenas na frente. Tema à escolha.', 'copos', 500, null, null, 99, array['https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80'], true),
  ('copo-long-drink', 'Copo Long Drink', 'Personalização apenas na frente. Tema à escolha.', 'copos', 450, null, null, 99, array['https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800&q=80'], true),
  ('copo-brasileirinho', 'Copo Brasileirinho', 'Personalizado.', 'copos', 400, null, 10, 99, array['https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80'], true),
  ('copo-descartavel-personalizado', 'Copo Descartável Personalizado', 'Personalizado.', 'copos', 200, null, 30, 99, array['https://images.unsplash.com/photo-1553361371-9b22f78e8b1d?w=800&q=80'], true),
  ('saquinho-de-doce-personalizado', 'Saquinho de Doce Personalizado', 'Tamanho 14x20cm. Personalizado com tema à escolha.', 'lembrancinhas', 350, null, null, 99, array['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'], true),
  ('kit-soneca', 'Kit Soneca', 'Kit soneca personalizado com tema à escolha.', 'lembrancinhas', 2000, null, null, 99, array['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'], true),
  ('porta-moedas-simples', 'Porta Moedas Simples', 'Personalizado.', 'lembrancinhas', 320, null, 15, 99, array['https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80'], true),
  ('porta-moedas-mini-box', 'Porta Moedas Mini Box', 'Personalizado.', 'lembrancinhas', 430, null, 10, 99, array['https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80'], true),
  ('cofrinho-personalizado', 'Cofrinho Personalizado', 'Arte no papel fotográfico. Tema à escolha.', 'lembrancinhas', 450, null, null, 99, array['https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80'], true),
  ('almofada-de-colorir', 'Almofada de Colorir Personalizada', 'Tamanho 15x25cm. Personalizada com tema à escolha.', 'lembrancinhas', 900, null, null, 99, array['https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80'], true),
  ('lousa-magica', 'Lousa Mágica', 'Acompanha canetinha. Personalizada com tema à escolha.', 'lembrancinhas', 700, null, null, 99, array['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&q=80'], true),
  ('kit-lapis-marca-pagina', 'Kit Lápis + Marca Página Personalizado', 'Combo lápis + marca página, personalizado.', 'lembrancinhas', 350, null, null, 99, array['https://images.unsplash.com/photo-1513542789411-b6a5d4f31634?w=800&q=80'], true),
  ('botton-32mm', 'Botton 32mm', 'Já vai embalado. Pode ser imã ou chaveiro personalizado.', 'chaveiros', 300, null, null, 99, array['https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80'], true),
  ('botton-44mm', 'Botton 44mm', 'Pode ser imã ou chaveiro personalizado.', 'chaveiros', 450, null, null, 99, array['https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80'], true),
  ('botton-58mm', 'Botton 58mm', 'Pode ser imã ou chaveiro personalizado.', 'chaveiros', 600, null, null, 99, array['https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80'], true),
  ('almochaveiro-personalizado', 'Almochaveiro Personalizado', 'Personalizado.', 'chaveiros', 200, null, 20, 99, array['https://images.unsplash.com/photo-1607082349566-187342175e2f?w=800&q=80'], true)
on conflict (slug) do nothing;

-- ============================================================================
-- 7. CONTEÚDO EDITÁVEL DA HOME (site_content) — CMS leve
-- ============================================================================
-- Textos e fotos de apresentação da home, editáveis em /admin/site pelo
-- admin. Estrutura de layout/componentes continua fixa no código — só o
-- CONTEÚDO (texto e URL de imagem) de cada bloco fica dinâmico aqui.
create table if not exists public.site_content (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
drop policy if exists "site_content_public_read" on public.site_content;
create policy "site_content_public_read"
  on public.site_content for select
  using (true);
drop policy if exists "site_content_admin_write" on public.site_content;
create policy "site_content_admin_write"
  on public.site_content for all
  using (public.is_admin())
  with check (public.is_admin());

-- Seed com o conteúdo atual da home (o admin pode sobrescrever depois em
-- /admin/site). on conflict garante que rodar de novo não apaga edições já
-- feitas pelo admin.
insert into public.site_content (key, value) values
  ('home.hero', jsonb_build_object(
    'badge', 'Entrega em Salvador e Lauro de Freitas',
    'title', 'Tudo para te encantar. 🪄🧚‍♀️',
    'description', 'Transformamos momentos especiais em lembranças inesquecíveis. Bolsas personalizadas feitas com qualidade, carinho e atenção aos detalhes para surpreender seus convidados e tornar cada festa ainda mais especial.',
    'button_label', 'Ver produtos',
    'image_url', 'https://images.unsplash.com/photo-1530103862676-de8c9debad1d?w=900&q=80',
    'image_alt', 'Decoração de festa em tons de rosa com balões e arranjo'
  )),
  ('home.trust_cards', jsonb_build_array(
    jsonb_build_object('title', 'Retire sem taxa', 'description', 'Cabula/Tancredo Neves, seg-sáb 14h-18h'),
    jsonb_build_object('title', 'Entrega própria', 'description', 'Salvador e Lauro de Freitas, taxa fixa'),
    jsonb_build_object('title', 'Pagamento seguro', 'description', 'Pix ou cartão via Mercado Pago')
  ))
on conflict (key) do nothing;

-- ============================================================================
-- 8. REALTIME — permite o painel admin ouvir pedidos novos ao vivo
-- ============================================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'orders'
  ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end $$;

-- ============================================================================
-- 9. CRIAR SEU LOGIN DE ADMIN (faça isso por último, manualmente)
-- ============================================================================
-- 1. Vá para o site (local ou já publicado) e cadastre-se normalmente em
--    /cadastro com o e-mail e senha que você vai usar para administrar.
-- 2. Volte aqui no SQL Editor e rode (trocando o e-mail):
--
-- update public.profiles set role = 'admin'
-- where id = (select id from auth.users where email = 'seu-email@exemplo.com');
--
-- 3. Pronto — faça login em /login e acesse /admin.
-- ============================================================================

-- ============================================================================
-- 10. FORÇA O POSTGREST A RECARREGAR O CACHE DE SCHEMA AGORA
-- ============================================================================
-- O Supabase normalmente detecta mudanças de schema sozinho, mas às vezes
-- demora um pouco. Isso evita erros do tipo "could not find the 'x' column
-- of 'orders' in the schema cache" logo depois de rodar este script.
notify pgrst, 'reload schema';
