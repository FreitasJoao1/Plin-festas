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
  created_at timestamptz not null default now()
);

create index if not exists orders_user_id_idx on public.orders (user_id);
create index if not exists orders_status_idx on public.orders (status);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_order_code_idx on public.orders (order_code);

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
