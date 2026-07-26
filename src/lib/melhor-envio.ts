import { OrderItem } from "./types";

const MELHOR_ENVIO_BASE = "https://api.melhorenvio.com.br/api/v2";
// Troque para "https://sandbox.melhorenvio.com.br/api/v2" enquanto testa
// com um token de sandbox.

export function isMelhorEnvioConfigured(): boolean {
  return Boolean(
    process.env.MELHOR_ENVIO_TOKEN && process.env.MELHOR_ENVIO_CEP_ORIGEM
  );
}

/**
 * Calcula o frete dos Correios (PAC) para um CEP de destino via Melhor
 * Envio. Retorna `null` se a API não estiver configurada, o CEP for
 * inválido ou a cotação falhar — nesses casos o checkout cai
 * automaticamente para "frete por conta do cliente" (ver shipping.ts).
 *
 * TODO: as dimensões/peso abaixo são um valor padrão de "caixa de
 * decoração de festa". Para cotações mais precisas, cadastre peso e
 * dimensões reais por produto (adicione essas colunas em `products` e
 * substitua o valor fixo pela soma real dos itens do carrinho).
 */
export async function calculateCorreiosFreightCents(
  cepDestino: string,
  items: OrderItem[]
): Promise<number | null> {
  if (!isMelhorEnvioConfigured()) return null;

  const cleanCep = cepDestino.replace(/\D/g, "");
  if (cleanCep.length !== 8) return null;

  try {
    const res = await fetch(`${MELHOR_ENVIO_BASE}/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.MELHOR_ENVIO_TOKEN}`,
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": "Plin Designs (contato@plinfestas.com.br)",
      },
      body: JSON.stringify({
        from: { postal_code: process.env.MELHOR_ENVIO_CEP_ORIGEM },
        to: { postal_code: cleanCep },
        products: [
          {
            id: "pacote-padrao",
            width: 30,
            height: 20,
            length: 30,
            weight: 1,
            insurance_value:
              items.reduce((s, i) => s + i.unit_price_cents * i.quantity, 0) /
              100,
            quantity: 1,
          },
        ],
      }),
      cache: "no-store",
    });

    if (!res.ok) return null;
    const quotes = await res.json();

    // A API retorna uma lista de serviços (PAC, SEDEX...); pegamos o mais
    // barato que não tenha vindo com erro.
    const valid = (quotes as any[]).filter((q) => q?.price && !q?.error);
    if (valid.length === 0) return null;

    const cheapest = valid.reduce((min, q) =>
      Number(q.price) < Number(min.price) ? q : min
    );
    return Math.round(Number(cheapest.price) * 100);
  } catch (err) {
    console.error("Erro ao consultar Melhor Envio:", err);
    return null;
  }
}
