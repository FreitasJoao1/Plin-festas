import { randomUUID } from "crypto";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { BALANCE_NSU_SUFFIX } from "@/lib/infinitepay";
import { Order, OrderItem, DeliveryCity, ShippingMethod, OrderStatus, BookingSettings, WeekOccupancy, PaymentMethod, PaymentPlan, DayStatus, DayStatusOverride, BookingStatus } from "@/lib/types";

export interface CreateOrderInput {
  order_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal_cents: number;
  /** Código do cupom já validado no servidor, ou null se nenhum foi usado. */
  coupon_code: string | null;
  /** Desconto em centavos já validado no servidor. */
  discount_cents: number;
  shipping_method: ShippingMethod;
  shipping_city: DeliveryCity | null;
  shipping_cents: number;
  total_cents: number;
  note: string | null;
  /** Data desejada pelo cliente para o evento/entrega (YYYY-MM-DD). Opcional. */
  booking_date: string | null;
  /** Default 'pending_approval'. Pedidos lançados manualmente pelo admin (WhatsApp/presencial) entram como 'approved'. */
  booking_status?: BookingStatus;
  /** 'full' (default) ou 'split_50_50'. Ver comentário em supabase/schema.sql. */
  payment_plan?: PaymentPlan;
  /** Obrigatório calcular no servidor quando payment_plan='split_50_50' — nunca aceitar valor vindo do client. */
  deposit_amount_cents?: number;
  balance_amount_cents?: number;
}

/**
 * Cria o pedido. Em modo demo (sem Supabase) retorna dados locais
 * suficientes para gerar a mensagem do WhatsApp.
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<
  | { ok: true; id: string; order_code: string }
  | { ok: false; error: string }
> {
  if (!isSupabaseConfigured()) {
    return { ok: true, id: `demo-${randomUUID()}`, order_code: input.order_code };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase!.auth.getUser();

  const { data, error } = await supabase!
    .from("orders")
    .insert({
      order_code: input.order_code,
      user_id: user?.id ?? null,
      customer_name: input.customer_name,
      customer_email: input.customer_email,
      customer_phone: input.customer_phone,
      items: input.items,
      subtotal_cents: input.subtotal_cents,
      coupon_code: input.coupon_code,
      discount_cents: input.discount_cents,
      shipping_method: input.shipping_method,
      shipping_city: input.shipping_city,
      shipping_cents: input.shipping_cents,
      total_cents: input.total_cents,
      status: "novo",
      note: input.note,
      booking_date: input.booking_date,
      booking_status: input.booking_status ?? "pending_approval",
      payment_plan: input.payment_plan ?? "full",
      deposit_amount_cents: input.deposit_amount_cents ?? 0,
      balance_amount_cents: input.balance_amount_cents ?? 0,
    })
    .select("id, order_code")
    .single();

  // O trigger `enforce_booking_capacity` pode rejeitar o insert (data no
  // passado, fora do horizonte, ou semana lotada) — isso chega aqui como
  // erro do Postgres, não como exceção JS, então precisa ser repassado
  // como resultado de negócio, não relançado como erro genérico 500.
  if (error) {
    // Código 42501 = "insufficient_privilege", a forma como o Postgres
    // reporta uma violação de Row Level Security ("new row violates
    // row-level security policy for table ..."). A policy
    // `orders_insert_anyone` (supabase/schema.sql) libera insert para
    // QUALQUER pessoa, logada ou não — então, se este erro aparecer, não é
    // porque o cliente não estava logado nem porque caiu no pedido mínimo
    // (isso já é barrado antes, com mensagem própria, em
    // src/app/api/checkout/route.ts). É sinal de que o banco Supabase em
    // uso está com as policies desatualizadas em relação a este arquivo —
    // normalmente porque supabase/schema.sql ainda não foi rodado (ou foi
    // rodado antes desta policy existir) no projeto Supabase real. Nunca
    // mostramos esse erro técnico cru pro cliente final.
    if (error.code === "42501") {
      console.error(
        "[createOrder] Violação de RLS ao inserir pedido — as policies do banco " +
          "provavelmente estão desatualizadas. Rode supabase/schema.sql inteiro " +
          "no SQL Editor do Supabase para sincronizar. Detalhe original:",
        error.message
      );
      return {
        ok: false,
        error:
          "Não foi possível registrar seu pedido por um problema técnico " +
          "temporário na loja. Por favor, tente novamente em instantes ou " +
          "fale com a gente pelo WhatsApp.",
      };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, id: data.id, order_code: data.order_code };
}

export async function getOrdersForUser(userId: string): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Erro ao buscar pedidos do cliente:", error.message);
    return [];
  }
  return data as Order[];
}

export async function getOrderById(id: string): Promise<Order | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return null;
  return data as Order;
}

/**
 * Busca um pedido pelo order_code (= infinitepay_order_nsu que enviamos).
 * Usada pelo webhook/payment_check, que só recebem o NSU, não o UUID.
 * Precisa da service_role porque roda sem sessão de usuário (chamada
 * server-to-server pela InfinitePay).
 *
 * O NSU do pagamento do SALDO (segunda metade do pagamento fracionado
 * 50/50) usa o sufixo "-SALDO" (ver BALANCE_NSU_SUFFIX em
 * src/lib/infinitepay.ts) para não colidir com o NSU do sinal/pagamento
 * integral, que é sempre o order_code puro — por isso removemos o sufixo
 * aqui antes de buscar, e quem chamou decide o que fazer sabendo se era
 * sinal ou saldo (ver isBalanceNsu()).
 */
export async function getOrderByCode(orderCode: string): Promise<Order | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;
  const plainCode = orderCode.endsWith(BALANCE_NSU_SUFFIX)
    ? orderCode.slice(0, -BALANCE_NSU_SUFFIX.length)
    : orderCode;
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_code", plainCode)
    .single();
  if (error) return null;
  return data as Order;
}

/**
 * Grava um pagamento InfinitePay como pendente logo após gerar o link —
 * assim o pedido já fica rastreável mesmo se o cliente nunca completar
 * o pagamento (permite ao admin ver "link gerado, aguardando").
 */
export async function markPaymentPending(
  orderId: string,
  orderNsu: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  const { error } = await supabase
    .from("orders")
    .update({ payment_status: "pending", infinitepay_order_nsu: orderNsu })
    .eq("id", orderId);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * ÚNICA função que deve gravar payment_status='paid'. SEMPRE deve ser
 * chamada depois de confirmar via checkPayment() (src/lib/infinitepay.ts)
 * — nunca a partir só do corpo do webhook ou dos query params do
 * redirect, que podem ser forjados por quem descobrir a URL.
 *
 * Usa service_role porque roda fora de qualquer sessão de usuário
 * (webhook chamado pela InfinitePay, sem cookies de auth).
 */
export async function markPaymentConfirmed(
  orderCode: string,
  payment: {
    transactionNsu: string;
    invoiceSlug: string;
    paidAmountCents: number;
    method: PaymentMethod;
  }
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServiceRoleClient();
  if (!supabase) return { error: "Service role não configurada." };
  const { error } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      payment_method: payment.method,
      infinitepay_transaction_nsu: payment.transactionNsu,
      infinitepay_invoice_slug: payment.invoiceSlug,
      infinitepay_paid_amount_cents: payment.paidAmountCents,
    })
    .eq("order_code", orderCode);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Equivalentes a markPaymentPending/markPaymentConfirmed, mas para o
 * SALDO (segunda metade do pagamento fracionado 50/50) — gravam nos
 * campos balance_* em vez dos campos payment_* e infinitepay_* originais,
 * que continuam representando sempre o sinal (ou o pagamento integral,
 * quando payment_plan='full'). Mesmo motivo de service_role: rodam sem
 * sessão de usuário.
 */
export async function markBalancePaymentPending(
  orderId: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  const { error } = await supabase
    .from("orders")
    .update({ balance_payment_status: "pending" })
    .eq("id", orderId);
  if (error) return { error: error.message };
  return { ok: true };
}

export async function markBalancePaymentConfirmed(
  orderCode: string,
  payment: {
    transactionNsu: string;
    invoiceSlug: string;
    paidAmountCents: number;
    method: PaymentMethod;
  }
): Promise<{ ok: true } | { error: string }> {
  const supabase = createServiceRoleClient();
  if (!supabase) return { error: "Service role não configurada." };
  const { error } = await supabase
    .from("orders")
    .update({
      balance_payment_status: "paid",
      balance_payment_method: payment.method,
      balance_infinitepay_transaction_nsu: payment.transactionNsu,
      balance_infinitepay_invoice_slug: payment.invoiceSlug,
      balance_infinitepay_paid_amount_cents: payment.paidAmountCents,
    })
    .eq("order_code", orderCode);
  if (error) return { error: error.message };
  return { ok: true };
}

// ============================================================================
// Funções de admin — usadas só dentro de /admin (rotas protegidas pelo
// middleware, que já garante role='admin' antes de a página renderizar).
// ============================================================================

export async function getAllOrders(): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Erro ao buscar pedidos (admin):", error.message);
    return [];
  }
  return data as Order[];
}

export async function updateOrderStatus(
  id: string,
  status: OrderStatus
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }
  const { error } = await supabase.from("orders").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

// ============================================================================
// Módulo de agendamento (capacity planning) — funções de admin
// ============================================================================

export async function getBookingSettings(): Promise<BookingSettings> {
  const supabase = await createClient();
  if (!supabase) return { weekly_capacity: 20, horizon_days: 180 };
  const { data, error } = await supabase
    .from("booking_settings")
    .select("weekly_capacity, horizon_days")
    .eq("id", 1)
    .single();
  if (error || !data) return { weekly_capacity: 20, horizon_days: 180 };
  return data;
}

/**
 * Ocupação por semana num intervalo de datas, para preencher o grid do
 * calendário (admin e cliente). Agrupa no servidor em vez de trazer todos
 * os pedidos pro client agregar — evita expor dados de outros clientes.
 */
function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay(); // 0=domingo
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  return d.toISOString().slice(0, 10);
}

export async function getWeekOccupancies(
  startDate: string,
  endDate: string
): Promise<WeekOccupancy[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const settings = await getBookingSettings();

  const [{ data: orders, error: ordersError }, { data: overrides, error: overridesError }] =
    await Promise.all([
      supabase
        .from("orders")
        .select("booking_date")
        .not("booking_date", "is", null)
        .gte("booking_date", startDate)
        .lte("booking_date", endDate)
        .in("booking_status", ["pending_approval", "approved"])
        .neq("status", "cancelado"),
      supabase
        .from("week_capacity_overrides")
        .select("week_start, capacity")
        .gte("week_start", mondayOf(startDate))
        .lte("week_start", endDate),
    ]);

  if (ordersError || !orders) return [];

  const overrideMap = new Map<string, number>(
    ((overrides ?? []) as { week_start: string; capacity: number }[]).map((o) => [
      o.week_start,
      o.capacity,
    ])
  );
  if (overridesError) {
    // Se a tabela de overrides falhar (ex: migration não rodada ainda),
    // não derruba a agenda inteira — só ignora overrides e usa o padrão global.
    console.error("Erro ao buscar week_capacity_overrides:", overridesError.message);
  }

  const buckets = new Map<string, number>();
  for (const row of orders as { booking_date: string }[]) {
    const weekStart = mondayOf(row.booking_date);
    buckets.set(weekStart, (buckets.get(weekStart) ?? 0) + 1);
  }
  // Garante que semanas com override apareçam mesmo sem nenhum pedido ainda.
  for (const weekStart of overrideMap.keys()) {
    if (!buckets.has(weekStart)) buckets.set(weekStart, 0);
  }

  return Array.from(buckets.entries())
    .map(([week_start, count]) => {
      const override = overrideMap.get(week_start);
      return {
        week_start,
        count,
        capacity: override ?? settings.weekly_capacity,
        has_override: override !== undefined,
      };
    })
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
}

/** Lê os overrides de status de dia dentro de um intervalo, para o grid do calendário. */
export async function getDayStatusOverrides(
  startDate: string,
  endDate: string
): Promise<DayStatusOverride[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("day_status_overrides")
    .select("date, status")
    .gte("date", startDate)
    .lte("date", endDate);
  if (error || !data) return [];
  return data as DayStatusOverride[];
}

/**
 * Define ou remove a cota de uma semana específica. Passar capacity=null
 * remove o override (volta a usar o padrão global weekly_capacity).
 */
export async function setWeekCapacityOverride(
  weekStart: string,
  capacity: number | null
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }
  if (capacity === null) {
    const { error } = await supabase
      .from("week_capacity_overrides")
      .delete()
      .eq("week_start", weekStart);
    if (error) return { error: error.message };
    return { ok: true };
  }
  if (!Number.isInteger(capacity) || capacity <= 0) {
    return { error: "Capacidade deve ser um número inteiro maior que zero." };
  }
  const { error } = await supabase
    .from("week_capacity_overrides")
    .upsert({ week_start: weekStart, capacity, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Define ou remove o status manual de um dia. Passar status=null (ou
 * "available") remove o override e o dia volta a refletir a ocupação calculada.
 */
export async function setDayStatusOverride(
  date: string,
  status: DayStatus | null
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }
  if (status === null || status === "available") {
    const { error } = await supabase.from("day_status_overrides").delete().eq("date", date);
    if (error) return { error: error.message };
    return { ok: true };
  }
  const { error } = await supabase
    .from("day_status_overrides")
    .upsert({ date, status, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Aprova a data solicitada — o pedido segue seu fluxo normal de produção. */
export async function approveBooking(
  id: string
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }
  const { error } = await supabase
    .from("orders")
    .update({ booking_status: "approved" })
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

/**
 * Lista os pedidos agendados dentro de um intervalo de datas — usado na
 * página /admin/agenda para o admin ver e agir (aprovar/recusar) sem
 * precisar abrir pedido por pedido.
 */
export async function getBookedOrdersInRange(
  startDate: string,
  endDate: string
): Promise<Order[]> {
  const supabase = await createClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .not("booking_date", "is", null)
    .gte("booking_date", startDate)
    .lte("booking_date", endDate)
    .order("booking_date", { ascending: true });
  if (error) {
    console.error("Erro ao buscar pedidos agendados:", error.message);
    return [];
  }
  return data as Order[];
}

export interface RejectBookingInput {
  reason: string;
  alternativeDate?: string | null;
  /** Se true, marca refund_status='refund_pending' — tarefa manual para o admin resolver o estorno fora do site (sem gateway de pagamento). */
  needsRefund: boolean;
}

/**
 * Recusa a data solicitada. Não mexe no `status` de produção — o pedido
 * fica com booking_status='rejected' e é responsabilidade do fluxo de
 * comunicação (WhatsApp/e-mail) resolver com o cliente uma nova data ou
 * cancelamento. Se needsRefund, sinaliza refund_status='refund_pending'
 * como tarefa manual — não existe gateway de pagamento neste projeto,
 * então o estorno em si é sempre feito por fora (Pix manual etc.).
 */
export async function rejectBooking(
  id: string,
  input: RejectBookingInput
): Promise<{ ok: true } | { error: string }> {
  const supabase = await createClient();
  if (!supabase) {
    return { error: "Supabase não está configurado neste ambiente (modo demo)." };
  }
  const { error } = await supabase
    .from("orders")
    .update({
      booking_status: "rejected",
      booking_rejection_reason: input.reason,
      booking_alternative_date: input.alternativeDate ?? null,
      refund_status: input.needsRefund ? "refund_pending" : "none",
    })
    .eq("id", id);
  if (error) return { error: error.message };
  return { ok: true };
}

export interface OrderMetrics {
  totalOrders: number;
  /** Soma de pedidos que já entraram no fluxo de produção (pago em diante). */
  totalRevenueCents: number;
  pendingCount: number;
  statusBreakdown: Record<OrderStatus, number>;
  recentOrders: Order[];
  /** Últimos 14 dias, para o gráfico de evolução. */
  dailySeries: { date: string; label: string; orders: number; revenueCents: number }[];
  /** Produtos mais pedidos (por quantidade total), para o gráfico de ranking. */
  topProducts: { name: string; quantity: number }[];
}

const REVENUE_STATUSES: OrderStatus[] = ["confirmado", "em_producao", "pronto", "enviado", "entregue"];

export async function getOrderMetrics(): Promise<OrderMetrics> {
  const orders = await getAllOrders();

  const statusBreakdown: Record<OrderStatus, number> = {
    novo: 0,
    confirmado: 0,
    em_producao: 0,
    pronto: 0,
    enviado: 0,
    entregue: 0,
    cancelado: 0,
  };

  let totalRevenueCents = 0;

  // Últimos 14 dias, do mais antigo para o mais recente
  const DAYS = 14;
  const dayBuckets = new Map<string, { orders: number; revenueCents: number }>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    dayBuckets.set(key, { orders: 0, revenueCents: 0 });
  }

  const productQty = new Map<string, number>();

  for (const order of orders) {
    statusBreakdown[order.status]++;
    if (REVENUE_STATUSES.includes(order.status)) {
      totalRevenueCents += order.total_cents;
    }

    const dayKey = order.created_at.slice(0, 10);
    const bucket = dayBuckets.get(dayKey);
    if (bucket) {
      bucket.orders += 1;
      if (REVENUE_STATUSES.includes(order.status)) {
        bucket.revenueCents += order.total_cents;
      }
    }

    for (const item of order.items) {
      productQty.set(item.name, (productQty.get(item.name) ?? 0) + item.quantity);
    }
  }

  const dailySeries = Array.from(dayBuckets.entries()).map(([date, v]) => ({
    date,
    label: new Date(date + "T12:00:00").toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }),
    orders: v.orders,
    revenueCents: v.revenueCents,
  }));

  const topProducts = Array.from(productQty.entries())
    .map(([name, quantity]) => ({ name, quantity }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);

  return {
    totalOrders: orders.length,
    totalRevenueCents,
    pendingCount: statusBreakdown.novo,
    statusBreakdown,
    recentOrders: orders.slice(0, 8),
    dailySeries,
    topProducts,
  };
}
