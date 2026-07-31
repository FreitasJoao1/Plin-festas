import { NextRequest, NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/products";
import { calculateCorreiosFreightCents } from "@/lib/melhor-envio";
import { getShippingQuote } from "@/lib/shipping";
import { createOrder } from "@/lib/orders";
import { generateOrderCode } from "@/lib/order-code";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { validateCoupon, incrementCouponUsage } from "@/lib/coupons";
import { DeliveryCity, OrderItem, ShippingMethod } from "@/lib/types";

interface CheckoutBody {
  customer: { name: string; email?: string; phone: string };
  cartItems: { product_id: string; quantity: number }[];
  shipping: { method: ShippingMethod; city?: DeliveryCity; cep?: string };
  note?: string;
  /** Data desejada pelo cliente para o evento/entrega, formato YYYY-MM-DD. */
  bookingDate?: string;
  /** Código do cupom de desconto aplicado no checkout, se houver. */
  couponCode?: string;
  /** 'full' (padrão) ou 'split_50_50' — 50% agora (sinal) + 50% na entrega. */
  paymentPlan?: "full" | "split_50_50";
}

const VALID_SHIPPING_METHODS: ShippingMethod[] = [
  "retirada", "entrega_propria", "uber_flash", "correios",
];
const VALID_CITIES: DeliveryCity[] = ["salvador", "lauro_de_freitas"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MAX_ITEMS = 60;
const MAX_QTY_PER_ITEM = 500;
const MAX_STRING = { name: 150, email: 200, phone: 30, note: 800 };

function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

/** Valida a forma do payload em runtime — nunca confiamos em `as CheckoutBody` sozinho. */
function validate(body: unknown): body is CheckoutBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  const customer = b.customer as Record<string, unknown> | undefined;
  if (
    typeof customer !== "object" || customer === null ||
    typeof customer.name !== "string" || typeof customer.phone !== "string" ||
    (customer.email !== undefined && typeof customer.email !== "string")
  ) return false;

  if (!Array.isArray(b.cartItems) || b.cartItems.length === 0 || b.cartItems.length > MAX_ITEMS) {
    return false;
  }
  for (const item of b.cartItems) {
    if (
      typeof item !== "object" || item === null ||
      typeof (item as any).product_id !== "string" ||
      typeof (item as any).quantity !== "number" ||
      !Number.isInteger((item as any).quantity) ||
      (item as any).quantity < 1 ||
      (item as any).quantity > MAX_QTY_PER_ITEM
    ) return false;
  }

  const shipping = b.shipping as Record<string, unknown> | undefined;
  if (
    typeof shipping !== "object" || shipping === null ||
    typeof shipping.method !== "string" ||
    !VALID_SHIPPING_METHODS.includes(shipping.method as ShippingMethod)
  ) return false;
  if (shipping.city !== undefined && !VALID_CITIES.includes(shipping.city as DeliveryCity)) {
    return false;
  }
  if (shipping.cep !== undefined && typeof shipping.cep !== "string") return false;

  if (b.note !== undefined && typeof b.note !== "string") return false;

  if (b.bookingDate !== undefined) {
    if (typeof b.bookingDate !== "string" || !DATE_RE.test(b.bookingDate)) return false;
  }

  if (b.couponCode !== undefined && typeof b.couponCode !== "string") return false;

  if (
    b.paymentPlan !== undefined &&
    b.paymentPlan !== "full" &&
    b.paymentPlan !== "split_50_50"
  ) return false;

  return true;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`checkout:${ip}`, { limit: 8, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente novamente." },
      { status: 429 }
    );
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return badRequest("JSON inválido.");
  }

  if (!validate(rawBody)) {
    return badRequest("Dados do pedido inválidos ou incompletos.");
  }
  const body = rawBody;

  const name = body.customer.name.trim().slice(0, MAX_STRING.name);
  const phone = body.customer.phone.trim().slice(0, MAX_STRING.phone);
  const email = (body.customer.email ?? "").trim().slice(0, MAX_STRING.email);
  const note = (body.note ?? "").trim().slice(0, MAX_STRING.note);

  if (!name || !phone) {
    return badRequest("Preencha nome e telefone.");
  }

  // Recalcula preços no servidor — nunca confia no client
  const products = await getProductsByIds(body.cartItems.map((i) => i.product_id));
  const items: OrderItem[] = [];

  for (const cartItem of body.cartItems) {
    const product = products.find((p) => p.id === cartItem.product_id);
    if (!product || !product.active) {
      return badRequest(`Produto indisponível: ${cartItem.product_id}`);
    }
    if (product.min_order && cartItem.quantity < product.min_order) {
      return badRequest(
        `"${product.name}" tem pedido mínimo de ${product.min_order} unidades.`
      );
    }
    const itemValueCents = product.price_cents * cartItem.quantity;
    if (product.min_order_value_cents && itemValueCents < product.min_order_value_cents) {
      return badRequest(
        `"${product.name}" tem pedido mínimo de R$ ${(product.min_order_value_cents / 100)
          .toFixed(2)
          .replace(".", ",")}.`
      );
    }
    items.push({
      product_id: product.id,
      name: product.name,
      unit_price_cents: product.price_cents,
      quantity: cartItem.quantity,
    });
  }

  const subtotal_cents = items.reduce(
    (s, i) => s + i.unit_price_cents * i.quantity,
    0
  );

  // Cupom de desconto — revalidado do zero aqui, no servidor, contra o
  // carrinho recém-recalculado acima. O que o client mandou como "desconto"
  // (se mandou algo) é ignorado; só o que sai de validateCoupon() conta.
  let coupon_code: string | null = null;
  let discount_cents = 0;
  let appliedCouponId: string | null = null;
  if (body.couponCode && body.couponCode.trim()) {
    const couponResult = await validateCoupon({
      code: body.couponCode,
      items,
      products,
    });
    if (!couponResult.ok) {
      return badRequest(couponResult.error);
    }
    coupon_code = couponResult.coupon.code;
    discount_cents = couponResult.discountCents;
    appliedCouponId = couponResult.coupon.id;
  }

  let correiosQuoteCents: number | null = null;
  if (body.shipping.method === "correios" && body.shipping.cep) {
    correiosQuoteCents = await calculateCorreiosFreightCents(
      body.shipping.cep.slice(0, 9),
      items
    );
  }

  const shippingQuote = getShippingQuote(body.shipping.method, {
    city: body.shipping.city,
    correiosQuoteCents,
  });

  const shipping_cents = shippingQuote.manual ? 0 : shippingQuote.price_cents;
  const total_cents = Math.max(0, subtotal_cents - discount_cents) + shipping_cents;

  // Pagamento fracionado 50/50 — calculado aqui, no servidor, sobre o
  // total_cents já recalculado (nunca sobre algo vindo do client).
  // balance = total - deposit (em vez de total/2 pros dois), pra sempre
  // somar exatamente o total mesmo com centavo ímpar (ex: total 1001 ->
  // depósito 501 + saldo 500, nunca "sobra"/"falta" 1 centavo).
  const payment_plan = body.paymentPlan === "split_50_50" ? "split_50_50" : "full";
  const deposit_amount_cents = payment_plan === "split_50_50" ? Math.round(total_cents / 2) : 0;
  const balance_amount_cents = payment_plan === "split_50_50" ? total_cents - deposit_amount_cents : 0;

  try {
    // Pequeno retry caso o código gerado colida (extremamente raro —
    // ver src/lib/order-code.ts para a probabilidade).
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const result = await createOrder({
          order_code: generateOrderCode(),
          customer_name: name,
          customer_email: email,
          customer_phone: phone,
          items,
          subtotal_cents,
          coupon_code,
          discount_cents,
          shipping_method: body.shipping.method,
          shipping_city: body.shipping.city ?? null,
          shipping_cents,
          total_cents,
          note: note || null,
          booking_date: body.bookingDate ?? null,
          payment_plan,
          deposit_amount_cents,
          balance_amount_cents,
        });

        if (!result.ok) {
          // Erro de negócio (semana lotada, data fora do horizonte etc.),
          // vindo do trigger de capacidade no banco — não é um bug, é a
          // regra funcionando. Repassa como 409, não como falha de servidor.
          return NextResponse.json({ error: result.error }, { status: 409 });
        }

        // Conta o uso do cupom só depois que o pedido foi criado com
        // sucesso — não deixa o checkout falhar por causa disso.
        if (appliedCouponId) {
          await incrementCouponUsage(appliedCouponId);
        }

        return NextResponse.json({
          orderId: result.id,
          orderCode: result.order_code,
          subtotal_cents,
          discount_cents,
          coupon_code,
          total_cents,
          payment_plan,
          deposit_amount_cents,
          balance_amount_cents,
        });
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError;
  } catch (err) {
    console.error("Erro ao criar pedido:", err);
    return NextResponse.json(
      { error: "Não foi possível processar o pedido. Tente novamente." },
      { status: 500 }
    );
  }
}
