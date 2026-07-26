import { DeliveryCity, ShippingMethod, ShippingQuote } from "./types";

/**
 * Regras de logística da Plin Designs.
 * Isso é lógica de negócio pura (sem I/O), então funciona 100% sem
 * nenhuma integração externa configurada — é a parte que "não depende
 * de nada" e já sai pronta.
 */

export const PICKUP_INFO = {
  addressLine: "Tancredo Neves / Cabula — em frente ao Condomínio Arvoredo",
  city: "Salvador - BA",
  hours: "Segunda a sábado, das 14h às 18h",
};

// Valores em centavos para evitar erro de ponto flutuante com dinheiro.
export const OWN_DELIVERY_FEES_CENTS: Record<DeliveryCity, number> = {
  salvador: 3000, // R$ 30,00
  lauro_de_freitas: 4500, // R$ 45,00
};

export const DELIVERY_CITY_LABELS: Record<DeliveryCity, string> = {
  salvador: "Salvador",
  lauro_de_freitas: "Lauro de Freitas",
};

export const SHIPPING_METHOD_LABELS: Record<ShippingMethod, string> = {
  retirada: "Retirada pessoal",
  entrega_propria: "Entrega própria",
  uber_flash: "Uber Flash",
  correios: "Correios",
};

export function formatBRL(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Calcula a cotação de frete para um método + (se aplicável) cidade.
 *
 * @param correiosQuoteCents  Valor já cotado via Melhor Envio (ver
 *   src/app/api/frete/route.ts). Se vier `null`, significa que a cotação
 *   automática não está disponível (API não configurada ou CEP não
 *   atendido) e o frete cai para "por conta do cliente", exatamente como
 *   pedido no briefing.
 */
export function getShippingQuote(
  method: ShippingMethod,
  opts: { city?: DeliveryCity; correiosQuoteCents?: number | null } = {}
): ShippingQuote {
  switch (method) {
    case "retirada":
      return {
        method,
        label: SHIPPING_METHOD_LABELS.retirada,
        price_cents: 0,
        manual: false,
        note: `Retire seu pedido em ${PICKUP_INFO.addressLine}. Horário de retirada: ${PICKUP_INFO.hours}.`,
      };

    case "entrega_propria": {
      const city = opts.city ?? "salvador";
      const price = OWN_DELIVERY_FEES_CENTS[city];
      return {
        method,
        label: `Entrega própria — ${DELIVERY_CITY_LABELS[city]}`,
        price_cents: price,
        manual: false,
        note: "O dia e o horário da entrega serão combinados com você após a confirmação da compra.",
      };
    }

    case "uber_flash":
      return {
        method,
        label: SHIPPING_METHOD_LABELS.uber_flash,
        price_cents: 0,
        manual: true,
        note: "O envio via Uber Flash é solicitado por você após a compra. A corrida é paga separadamente, direto no app do Uber, e combinamos o horário de retirada com o motorista pelo WhatsApp.",
      };

    case "correios": {
      if (opts.correiosQuoteCents != null) {
        return {
          method,
          label: "Correios (PAC/SEDEX)",
          price_cents: opts.correiosQuoteCents,
          manual: false,
          note: "Frete calculado automaticamente para o seu CEP.",
        };
      }
      return {
        method,
        label: "Correios",
        price_cents: 0,
        manual: true,
        note: "Não foi possível calcular o frete automaticamente agora. O envio pelos Correios fica por conta do cliente — combinamos o valor exato pelo WhatsApp antes do envio.",
      };
    }
  }
}

export const ALL_SHIPPING_METHODS: ShippingMethod[] = [
  "retirada",
  "entrega_propria",
  "uber_flash",
  "correios",
];
