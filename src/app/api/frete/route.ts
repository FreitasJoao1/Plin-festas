import { NextRequest, NextResponse } from "next/server";
import { calculateCorreiosFreightCents } from "@/lib/melhor-envio";
import { getShippingQuote } from "@/lib/shipping";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { OrderItem } from "@/lib/types";

const CEP_RE = /^\d{5}-?\d{3}$/;

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`frete:${ip}`, { limit: 20, windowMs: 60_000 })) {
    return NextResponse.json(
      { error: "Muitas tentativas. Aguarde um minuto e tente novamente." },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const cep = typeof b.cep === "string" ? b.cep.trim() : "";

  if (!CEP_RE.test(cep)) {
    return NextResponse.json({ error: "CEP inválido." }, { status: 400 });
  }

  // Os itens aqui só influenciam peso/dimensões da cotação (não o preço
  // cobrado, que é sempre recalculado no /api/checkout) — ainda assim
  // limitamos o tamanho do payload por segurança.
  const rawItems = Array.isArray(b.items) ? b.items.slice(0, 60) : [];
  const items = rawItems as OrderItem[];

  const quoteCents = await calculateCorreiosFreightCents(cep, items);
  const quote = getShippingQuote("correios", { correiosQuoteCents: quoteCents });

  return NextResponse.json(quote);
}
