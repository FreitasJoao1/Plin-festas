import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Coupon, CouponDiscountType, CouponScope, OrderItem, Product, ProductCategory } from "@/lib/types";

// ============================================================================
// Validação de cupom no checkout (rota pública) — usa service_role porque a
// tabela `coupons` não tem policy de leitura pública (ver supabase/schema.sql,
// seção 4d): se qualquer visitante pudesse fazer SELECT * na tabela, daria
// pra listar todos os códigos ativos, o que anula o propósito de um cupom
// "secreto". Aqui sempre buscamos POR CÓDIGO, nunca listamos a tabela toda
// para o cliente.
// ============================================================================

export interface CouponValidationInput {
  code: string;
  /** Itens do carrinho já com preço/produto resolvidos no servidor (ver /api/checkout). */
  items: OrderItem[];
  /** Produtos correspondentes aos itens acima, para checar categoria/id no escopo do cupom. */
  products: Product[];
}

export type CouponValidationResult =
  | {
      ok: true;
      coupon: Coupon;
      /** Desconto final em centavos, já limitado ao subtotal elegível. */
      discountCents: number;
      /** Soma dos itens elegíveis ao cupom (antes do desconto). */
      eligibleSubtotalCents: number;
    }
  | { ok: false; error: string };

function isCouponCurrentlyValid(coupon: Coupon, now: Date): string | null {
  if (!coupon.active) return "Este cupom não está mais ativo.";
  if (coupon.valid_from && now < new Date(coupon.valid_from)) {
    return "Este cupom ainda não está válido.";
  }
  if (coupon.valid_until && now > new Date(coupon.valid_until)) {
    return "Este cupom expirou.";
  }
  if (coupon.max_uses !== null && coupon.used_count >= coupon.max_uses) {
    return "Este cupom já atingiu o limite de usos.";
  }
  return null;
}

/**
 * Calcula quais itens do carrinho são elegíveis ao escopo do cupom
 * (todos / uma categoria / uma lista de produtos específicos) e a soma
 * desses itens em centavos.
 */
function eligibleSubtotalCents(
  coupon: Coupon,
  items: OrderItem[],
  products: Product[]
): number {
  const productById = new Map(products.map((p) => [p.id, p]));

  return items.reduce((sum, item) => {
    if (coupon.scope === "all") return sum + item.unit_price_cents * item.quantity;

    const product = productById.get(item.product_id);
    if (!product) return sum;

    if (coupon.scope === "category") {
      if (product.category === coupon.scope_category) {
        return sum + item.unit_price_cents * item.quantity;
      }
      return sum;
    }

    // scope === "products"
    if (coupon.scope_product_ids.includes(item.product_id)) {
      return sum + item.unit_price_cents * item.quantity;
    }
    return sum;
  }, 0);
}

/**
 * Valida um cupom contra o carrinho ATUAL (recalculado no servidor) e
 * retorna o desconto em centavos já aplicado corretamente ao escopo do
 * cupom. NUNCA confie em um valor de desconto vindo do client.
 */
export async function validateCoupon(
  input: CouponValidationInput
): Promise<CouponValidationResult> {
  const code = input.code.trim().toUpperCase();
  if (!code) return { ok: false, error: "Informe um código de cupom." };

  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Cupons não estão disponíveis neste ambiente (modo demo)." };
  }

  const supabase = await createClient();
  if (!supabase) {
    return { ok: false, error: "Cupons não estão disponíveis neste ambiente (modo demo)." };
  }

  // RPC security definer — funciona com o cliente normal (anon/RLS), sem
  // depender de SUPABASE_SERVICE_ROLE_KEY. Ver get_coupon_by_code em
  // supabase/schema.sql.
  const { data, error } = await supabase.rpc("get_coupon_by_code", { p_code: code });

  if (error) {
    console.error("Erro ao buscar cupom:", error.message, error.code);
    // PGRST202/PGRST205 = função/tabela não encontrada no schema cache —
    // sinal claro de que supabase/schema.sql ainda não foi rodado (ou está
    // desatualizado) no projeto Supabase em uso, não um cupom inválido.
    if (error.code === "PGRST202" || error.code === "PGRST205") {
      return {
        ok: false,
        error:
          "Cupons ainda não foram configurados neste banco. Rode supabase/schema.sql no SQL Editor do Supabase.",
      };
    }
    return { ok: false, error: "Não foi possível validar o cupom no momento. Tente novamente." };
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { ok: false, error: "Cupom inválido ou inexistente." };
  }

  const coupon = row as Coupon;

  const validityError = isCouponCurrentlyValid(coupon, new Date());
  if (validityError) return { ok: false, error: validityError };

  const eligibleCents = eligibleSubtotalCents(coupon, input.items, input.products);

  if (eligibleCents <= 0) {
    return {
      ok: false,
      error:
        coupon.scope === "all"
          ? "Seu carrinho está vazio."
          : "Nenhum item do carrinho é elegível para este cupom.",
    };
  }

  if (coupon.min_order_value_cents && eligibleCents < coupon.min_order_value_cents) {
    const minReais = (coupon.min_order_value_cents / 100).toFixed(2).replace(".", ",");
    return {
      ok: false,
      error: `Este cupom exige um mínimo de R$ ${minReais} em produtos elegíveis.`,
    };
  }

  let discountCents =
    coupon.discount_type === "percentage"
      ? Math.round((eligibleCents * coupon.discount_value) / 100)
      : coupon.discount_value;

  // O desconto nunca pode ultrapassar o valor dos itens elegíveis (evita
  // "total negativo" com cupom fixo maior que o carrinho).
  discountCents = Math.min(discountCents, eligibleCents);

  return { ok: true, coupon, discountCents, eligibleSubtotalCents: eligibleCents };
}

/**
 * Incrementa o contador de usos do cupom. Chamada depois que o pedido é
 * criado com sucesso (src/app/api/checkout/route.ts). RPC security
 * definer — mesmo motivo de get_coupon_by_code: funciona com o cliente
 * normal do checkout público, sem depender de service_role.
 */
export async function incrementCouponUsage(couponId: string): Promise<void> {
  const supabase = await createClient();
  if (!supabase) return;
  const { error } = await supabase.rpc("increment_coupon_usage", { p_coupon_id: couponId });
  if (error) {
    // Não falha o checkout por isso — o pedido já foi criado. Só loga.
    console.error("Erro ao incrementar uso do cupom:", error.message);
  }
}

// ============================================================================
// Funções de admin — usadas só dentro de /admin/cupons (rotas protegidas
// por requireAdmin(), ver src/lib/auth.ts).
// ============================================================================

export async function getAllCouponsAdmin(): Promise<Coupon[]> {
  if (!isSupabaseConfigured()) return [];

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("coupons")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Erro ao buscar cupons (admin):", error.message);
    return [];
  }
  return data as Coupon[];
}

export async function getCouponById(id: string): Promise<Coupon | null> {
  if (!isSupabaseConfigured()) return null;

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("coupons")
    .select("*")
    .eq("id", id)
    .single();

  if (error) return null;
  return data as Coupon;
}

export interface CouponInput {
  code: string;
  description: string;
  discount_type: CouponDiscountType;
  discount_value: number;
  scope: CouponScope;
  scope_category: ProductCategory | null;
  scope_product_ids: string[];
  min_order_value_cents: number | null;
  max_uses: number | null;
  active: boolean;
  valid_from: string | null;
  valid_until: string | null;
}

type AdminResult<T> = { data: T; error?: undefined } | { data?: undefined; error: string };

export async function createCoupon(
  input: CouponInput
): Promise<AdminResult<{ id: string }>> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase não está configurado neste ambiente (modo demo) — configure as variáveis do .env.local para criar cupons de verdade.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase!
    .from("coupons")
    .insert({ ...input, code: input.code.trim().toUpperCase() })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe um cupom com esse código." };
    }
    return { error: error.message };
  }
  return { data: { id: data.id } };
}

export async function updateCoupon(
  id: string,
  input: Partial<CouponInput>
): Promise<AdminResult<{ ok: true }>> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }

  const supabase = await createClient();
  const payload = { ...input };
  if (payload.code) payload.code = payload.code.trim().toUpperCase();

  const { error } = await supabase!.from("coupons").update(payload).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { error: "Já existe um cupom com esse código." };
    }
    return { error: error.message };
  }
  return { data: { ok: true } };
}

export async function deleteCoupon(id: string): Promise<AdminResult<{ ok: true }>> {
  if (!isSupabaseConfigured()) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }

  const supabase = await createClient();
  const { error } = await supabase!.from("coupons").delete().eq("id", id);

  if (error) return { error: error.message };
  return { data: { ok: true } };
}
