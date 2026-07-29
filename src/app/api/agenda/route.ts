import { NextRequest, NextResponse } from "next/server";
import { getWeekOccupancies, getBookingSettings } from "@/lib/orders";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Leitura pública (sem auth) — o cliente precisa ver ocupação/disponibilidade
 * ANTES de fazer login para escolher a data no checkout. Só retorna
 * contagens agregadas por semana, nunca dados individuais de pedidos.
 */
export async function GET(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkRateLimit(`agenda:${ip}`, { limit: 60, windowMs: 60_000 })) {
    return NextResponse.json({ error: "Muitas tentativas." }, { status: 429 });
  }

  const { searchParams } = new URL(req.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end || !DATE_RE.test(start) || !DATE_RE.test(end)) {
    return NextResponse.json(
      { error: "Parâmetros 'start' e 'end' são obrigatórios, formato YYYY-MM-DD." },
      { status: 400 }
    );
  }

  const [settings, weeks] = await Promise.all([
    getBookingSettings(),
    getWeekOccupancies(start, end),
  ]);

  return NextResponse.json({ settings, weeks });
}
