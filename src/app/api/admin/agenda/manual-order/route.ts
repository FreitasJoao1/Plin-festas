import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { getProductsByIds } from "@/lib/products";
import { createOrder } from "@/lib/orders";
import { generateOrderCode } from "@/lib/order-code";
import { DeliveryCity, OrderItem, ShippingMethod } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_SHIPPING_METHODS: ShippingMethod[] = [
  "retirada", "entrega_propria", "uber_flash", "correios",
];
const VALID_CITIES: DeliveryCity[] = ["salvador", "lauro_de_freitas"];
const MAX_ITEMS = 60;
const MAX_QTY_PER_ITEM = 500;

interface ManualOrderBody {
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  cartItems: { product_id: string; quantity: number }[];
  booking_date: string;
  shipping_method: ShippingMethod;
  shipping_city?: DeliveryCity;
  shipping_cents?: number;
  note?: string;
}

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/**
 * Cria um pedido lançado manualmente pelo admin (WhatsApp, presencial, etc.),
 * já vinculado a uma data e contando normalmente contra a cota da semana
 * (mesmo trigger enforce_booking_capacity dos pedidos do storefront).
 * Entra direto como booking_status='approved', já que é o próprio admin
 * confirmando a data.
 */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return NextResponse.json({ error: guard.error }, { status: guard.status });

  const body = (await req.json().catch(() => null)) as ManualOrderBody | null;
  if (!body || typeof body !== "object") return badRequest("JSON inválido.");

  if (typeof body.customer_name !== "string" || !body.customer_name.trim()) {
    return badRequest("Nome do cliente é obrigatório.");
  }
  if (!body.booking_date || !DATE_RE.test(body.booking_date)) {
    return badRequest("Data do agendamento é obrigatória, formato YYYY-MM-DD.");
  }
  if (!Array.isArray(body.cartItems) || body.cartItems.length === 0 || body.cartItems.length > MAX_ITEMS) {
    return badRequest("Adicione pelo menos um produto ao pedido.");
  }
  for (const item of body.cartItems) {
    if (
      typeof item !== "object" || item === null ||
      typeof item.product_id !== "string" ||
      typeof item.quantity !== "number" || !Number.isInteger(item.quantity) ||
      item.quantity < 1 || item.quantity > MAX_QTY_PER_ITEM
    ) {
      return badRequest("Item de pedido inválido.");
    }
  }
  if (!body.shipping_method || !VALID_SHIPPING_METHODS.includes(body.shipping_method)) {
    return badRequest("Método de entrega inválido.");
  }
  if (body.shipping_city !== undefined && !VALID_CITIES.includes(body.shipping_city)) {
    return badRequest("Cidade de entrega inválida.");
  }
  const shippingCents = Number.isInteger(body.shipping_cents) && (body.shipping_cents as number) >= 0
    ? (body.shipping_cents as number)
    : 0;

  // Recalcula preços no servidor a partir do catálogo — mesmo em pedido
  // manual, nunca confiamos em preço digitado livre no client.
  const products = await getProductsByIds(body.cartItems.map((i) => i.product_id));
  const items: OrderItem[] = [];
  for (const cartItem of body.cartItems) {
    const product = products.find((p) => p.id === cartItem.product_id);
    if (!product) return badRequest(`Produto não encontrado: ${cartItem.product_id}`);
    // Pedido mínimo por produto continua valendo mesmo em lançamento manual,
    // para manter a mesma regra de negócio em qualquer canal de entrada.
    if (product.min_order && cartItem.quantity < product.min_order) {
      return badRequest(`"${product.name}" tem pedido mínimo de ${product.min_order} unidades.`);
    }
    items.push({
      product_id: product.id,
      name: product.name,
      unit_price_cents: product.price_cents,
      quantity: cartItem.quantity,
    });
  }

  const subtotal_cents = items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0);
  const total_cents = subtotal_cents + shippingCents;

  let lastError: string | undefined;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await createOrder({
      order_code: generateOrderCode(),
      customer_name: body.customer_name.trim().slice(0, 150),
      customer_email: (body.customer_email ?? "").trim().slice(0, 200),
      customer_phone: (body.customer_phone ?? "").trim().slice(0, 30),
      items,
      subtotal_cents,
      shipping_method: body.shipping_method,
      shipping_city: body.shipping_city ?? null,
      shipping_cents: shippingCents,
      total_cents,
      note: (body.note ?? "Pedido lançado manualmente pelo admin.").trim().slice(0, 800),
      booking_date: body.booking_date,
      booking_status: "approved",
    });
    if (result.ok) {
      return NextResponse.json({ ok: true, id: result.id, order_code: result.order_code });
    }
    // Erro de colisão de código é raro e já tem retry; outros erros do
    // trigger (capacidade/horizonte) não adianta repetir.
    lastError = result.error;
    if (!result.error.includes("duplicate") && !result.error.includes("unique")) break;
  }

  return badRequest(lastError ?? "Não foi possível criar o pedido.");
}
