import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { Order, OrderItem, DeliveryCity, ShippingMethod, OrderStatus } from "@/lib/types";

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
}

/**
 * Cria o pedido. Em modo demo (sem Supabase) retorna dados locais
 * suficientes para gerar a mensagem do WhatsApp.
 */
export async function createOrder(
  input: CreateOrderInput
): Promise<Pick<Order, "id" | "order_code">> {
  if (!isSupabaseConfigured()) {
    return { id: `demo-${randomUUID()}`, order_code: input.order_code };
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
    })
    .select("id, order_code")
    .single();

  if (error) throw new Error(`Erro ao criar pedido: ${error.message}`);
  return data;
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

export async function attachPreferenceToOrder(
  orderId: string,
  preferenceId: string
) {
  if (!isSupabaseConfigured() || orderId.startsWith("demo-")) return;
  const supabase = await createClient();
  await supabase!
    .from("orders")
    .update({ mp_preference_id: preferenceId })
    .eq("id", orderId);
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
