import { randomUUID } from "crypto";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Order, OrderItem, DeliveryCity, ShippingMethod, OrderStatus, BookingSettings, WeekOccupancy, PaymentMethod } from "@/lib/types";

export interface CreateOrderInput {
  order_code: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  items: OrderItem[];
  subtotal_cents: number;
  shipping_method: ShippingMethod;
  shipping_city: DeliveryCity | null;
  shipping_cents: number;
  total_cents: number;
  note: string | null;
  /** Data desejada pelo cliente para o evento/entrega (YYYY-MM-DD). Opcional. */
  booking_date: string | null;
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
      shipping_method: input.shipping_method,
      shipping_city: input.shipping_city,
      shipping_cents: input.shipping_cents,
      total_cents: input.total_cents,
      status: "novo",
      note: input.note,
      booking_date: input.booking_date,
    })
    .select("id, order_code")
    .single();

  // O trigger `enforce_booking_capacity` pode rejeitar o insert (data no
  // passado, fora do horizonte, ou semana lotada) — isso chega aqui como
  // erro do Postgres, não como exceção JS, então precisa ser repassado
  // como resultado de negócio, não relançado como erro genérico 500.
  if (error) {
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
 */
export async function getOrderByCode(orderCode: string): Promise<Order | null> {
  const supabase = createServiceRoleClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("orders")
    .select("*")
    .eq("order_code", orderCode)
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
  if (!supabase) return { weekly_capacity: 20, horizon_days: 60 };
  const { data, error } = await supabase
    .from("booking_settings")
    .select("weekly_capacity, horizon_days")
    .eq("id", 1)
    .single();
  if (error || !data) return { weekly_capacity: 20, horizon_days: 60 };
  return data;
}

/**
 * Ocupação por semana num intervalo de datas, para preencher o grid do
 * calendário (admin e cliente). Agrupa no servidor em vez de trazer todos
 * os pedidos pro client agregar — evita expor dados de outros clientes.
 */
export async function getWeekOccupancies(
  startDate: string,
  endDate: string
): Promise<WeekOccupancy[]> {
  const supabase = await createClient();
  if (!supabase) return [];

  const settings = await getBookingSettings();

  const { data, error } = await supabase
    .from("orders")
    .select("booking_date")
    .not("booking_date", "is", null)
    .gte("booking_date", startDate)
    .lte("booking_date", endDate)
    .in("booking_status", ["pending_approval", "approved"])
    .neq("status", "cancelado");

  if (error || !data) return [];

  const buckets = new Map<string, number>();
  for (const row of data as { booking_date: string }[]) {
    const d = new Date(row.booking_date + "T12:00:00");
    // Segunda-feira da semana (getDay: 0=domingo)
    const day = d.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diffToMonday);
    const weekStart = d.toISOString().slice(0, 10);
    buckets.set(weekStart, (buckets.get(weekStart) ?? 0) + 1);
  }

  return Array.from(buckets.entries())
    .map(([week_start, count]) => ({ week_start, count, capacity: settings.weekly_capacity }))
    .sort((a, b) => a.week_start.localeCompare(b.week_start));
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
