/**
 * Valor mínimo do pedido para liberar a opção de pagamento fracionado
 * (50% agora + 50% na entrega). Abaixo disso, só "100% agora".
 *
 * Única fonte da regra — o checkout (preview/UI) e a rota /api/checkout
 * (autoridade final) importam daqui, pra nunca ficar dessincronizado.
 */
export const SPLIT_PAYMENT_MIN_CENTS = 10000; // R$ 100,00

export function isSplitPaymentEligible(totalCents: number): boolean {
  return totalCents >= SPLIT_PAYMENT_MIN_CENTS;
}
