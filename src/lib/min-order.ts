import { Product } from "@/lib/types";

/**
 * Pedido mínimo por produto — OPCIONAL e configurado pelo admin como
 * "por quantidade" OU "por valor" (nunca os dois ao mesmo tempo; ver
 * checagem em validate-product.ts e a constraint no schema.sql).
 *
 * Este arquivo é a ÚNICA fonte da regra: tanto a UI (ProductCard,
 * ProductDetailActions, CartDrawer) quanto a validação autoritativa do
 * servidor (/api/checkout) importam daqui, pra nunca ficar dessincronizado.
 */

export function hasMinOrder(product: Pick<Product, "min_order" | "min_order_value_cents">): boolean {
  return Boolean(product.min_order) || Boolean(product.min_order_value_cents);
}

/** Menor quantidade que satisfaz o pedido mínimo do produto (1 se não houver mínimo). */
export function getMinQuantity(product: Pick<Product, "min_order" | "min_order_value_cents" | "price_cents">): number {
  if (product.min_order && product.min_order > 0) return product.min_order;
  if (product.min_order_value_cents && product.price_cents > 0) {
    return Math.ceil(product.min_order_value_cents / product.price_cents);
  }
  return 1;
}

/** Verifica se uma quantidade escolhida satisfaz o mínimo do produto. */
export function meetsMinOrder(
  product: Pick<Product, "min_order" | "min_order_value_cents" | "price_cents">,
  quantity: number
): boolean {
  if (product.min_order && quantity < product.min_order) return false;
  if (product.min_order_value_cents && quantity * product.price_cents < product.min_order_value_cents) {
    return false;
  }
  return true;
}

/** Texto curto pra exibir no card/detalhe do produto, ex: "mín. 3 un." ou "mín. R$ 50,00". */
export function getMinOrderLabel(product: Pick<Product, "min_order" | "min_order_value_cents">): string | null {
  if (product.min_order) return `mín. ${product.min_order} un.`;
  if (product.min_order_value_cents) {
    return `mín. ${(product.min_order_value_cents / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    })}`;
  }
  return null;
}
