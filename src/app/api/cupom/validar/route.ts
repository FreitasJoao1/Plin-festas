import { NextRequest, NextResponse } from "next/server";
import { getProductsByIds } from "@/lib/products";
import { validateCoupon } from "@/lib/coupons";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { OrderItem } from "@/lib/types";

interface ValidateBody {
  code: string;
  cartItems: { product_id: string; quantity: number }[];
}

const MAX_ITEMS = 60;
const MAX_QTY_PER_ITEM = 500;

function badRequest(message: string) {
  return NextResponse.json({ valid: false, error: message }, { status: 400 });
}

function validate(body: unknown): body is ValidateBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;

  if (typeof b.code !== "string" || !b.code.trim()) return false;

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

  return true;
}

/**
 * Valida um cupom de desconto contra o carrinho atual — SEMPRE recalcula
 * preços e escopo no servidor (nunca confia no client), mesma lógica que
 * roda de novo dentro de /api/checkout na hora de fato criar o pedido.
 * Esta rota é só para o campo "cupom" no checkout mostrar o desconto ANTES
 * de o cliente confirmar o pedido.
 */
export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  // Limite mais generoso que o checkout (o cliente pode tentar alguns
  // códigos digitando errado), mas ainda protege contra força bruta.
  if (!checkRateLimit(`cupom:${ip}`, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json(
      { valid: false, error: "Muitas tentativas. Aguarde um minuto e tente novamente." },
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
    return badRequest("Dados inválidos.");
  }

  const products = await getProductsByIds(rawBody.cartItems.map((i) => i.product_id));
  const items: OrderItem[] = [];

  for (const cartItem of rawBody.cartItems) {
    const product = products.find((p) => p.id === cartItem.product_id);
    if (!product || !product.active) continue;
    items.push({
      product_id: product.id,
      name: product.name,
      unit_price_cents: product.price_cents,
      quantity: cartItem.quantity,
    });
  }

  if (items.length === 0) {
    return badRequest("Seu carrinho está vazio.");
  }

  const result = await validateCoupon({ code: rawBody.code, items, products });
  if (!result.ok) {
    return NextResponse.json({ valid: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json({
    valid: true,
    code: result.coupon.code,
    description: result.coupon.description,
    discountCents: result.discountCents,
    eligibleSubtotalCents: result.eligibleSubtotalCents,
  });
}
