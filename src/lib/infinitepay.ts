import { OrderItem } from "@/lib/types";

/**
 * Integração com o Checkout da InfinitePay (checkout hospedado, não o
 * gateway embutido via ipay.js). Doc oficial:
 * https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-da-infinitepay
 *
 * MODELO DE CONFIANÇA — leia antes de mexer aqui:
 * A InfinitePay não documenta assinatura/HMAC no webhook. Isso significa
 * que qualquer pessoa que descobrir a URL do webhook pode, em teoria,
 * enviar um payload forjado dizendo "esse pedido foi pago". Por isso:
 *   1. O webhook NUNCA marca um pedido como pago só por ter recebido a
 *      chamada — ele sempre CONFIRMA com a InfinitePay via payment_check
 *      (POST server-to-server, autenticado pelo nosso handle) antes de
 *      gravar qualquer coisa no banco.
 *   2. payment_check é a fonte de verdade. O webhook só serve como
 *      "gatilho" para ir confirmar mais rápido — não como prova em si.
 */

const BASE_URL = "https://api.checkout.infinitepay.io";

/**
 * Pagamento fracionado 50/50: o sinal (ou pagamento integral) sempre usa
 * order_code como order_nsu, exatamente como antes — nenhuma mudança
 * pro fluxo já existente. O SALDO (segunda metade, cobrado na entrega)
 * usa order_code + este sufixo, pra virar um NSU diferente na InfinitePay
 * (não pode reusar o mesmo NSU para duas transações) e ainda assim dar
 * pra achar o pedido de volta (ver getOrderByCode em src/lib/orders.ts).
 */
export const BALANCE_NSU_SUFFIX = "-SALDO";

export function isBalanceNsu(orderNsu: string): boolean {
  return orderNsu.endsWith(BALANCE_NSU_SUFFIX);
}

function getHandle(): string | null {
  return process.env.INFINITEPAY_HANDLE || null;
}

export function isInfinitePayConfigured(): boolean {
  return Boolean(getHandle());
}

export interface CreatePaymentLinkInput {
  orderNsu: string;
  items: OrderItem[];
  shippingCents: number;
  redirectUrl: string;
  webhookUrl: string;
  customer: { name: string; email: string; phone: string };
}

export interface CreatePaymentLinkResult {
  ok: true;
  url: string;
}

export interface CreatePaymentLinkError {
  ok: false;
  error: string;
}

/**
 * Gera o link de pagamento hospedado. Preço sempre em centavos, conforme
 * a doc. O frete entra como um item extra em vez de um campo separado —
 * a API da InfinitePay não tem conceito de frete, só de itens.
 */
export async function createPaymentLink(
  input: CreatePaymentLinkInput
): Promise<CreatePaymentLinkResult | CreatePaymentLinkError> {
  const handle = getHandle();
  if (!handle) {
    return { ok: false, error: "InfinitePay não está configurada neste ambiente." };
  }

  const items = input.items.map((i) => ({
    quantity: i.quantity,
    price: i.unit_price_cents,
    description: i.name.slice(0, 120),
  }));

  if (input.shippingCents > 0) {
    items.push({ quantity: 1, price: input.shippingCents, description: "Frete" });
  }

  // Telefone da InfinitePay espera formato internacional (+55...).
  // O checkout já valida "com DDD" mas não garante o +55 — normaliza aqui.
  const digits = input.customer.phone.replace(/\D/g, "");
  const phoneE164 = digits.startsWith("55") ? `+${digits}` : `+55${digits}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        redirect_url: input.redirectUrl,
        webhook_url: input.webhookUrl,
        order_nsu: input.orderNsu,
        customer: {
          name: input.customer.name,
          email: input.customer.email || undefined,
          phone_number: phoneE164,
        },
        items,
      }),
    });
  } catch {
    return { ok: false, error: "Não foi possível conectar à InfinitePay." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `InfinitePay respondeu ${res.status}: ${text.slice(0, 200)}` };
  }

  const data = await res.json().catch(() => null);
  if (!data?.url) {
    return { ok: false, error: "Resposta inesperada da InfinitePay (sem 'url')." };
  }

  return { ok: true, url: data.url };
}

export interface PaymentCheckResult {
  success: boolean;
  paid: boolean;
  amountCents?: number;
  paidAmountCents?: number;
  captureMethod?: "pix" | "credit_card";
}

/**
 * Confirma server-to-server se um pedido foi realmente pago. Esta é a
 * ÚNICA função que deve resultar em gravar payment_status='paid' no
 * banco — nunca confie direto no corpo do webhook ou nos query params
 * do redirect (ambos podem ser forjados por quem souber a URL).
 */
export async function checkPayment(
  orderNsu: string,
  transactionNsu: string,
  slug: string
): Promise<PaymentCheckResult | null> {
  const handle = getHandle();
  if (!handle) return null;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/payment_check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        handle,
        order_nsu: orderNsu,
        transaction_nsu: transactionNsu,
        slug,
      }),
    });
  } catch {
    return null;
  }

  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data) return null;

  return {
    success: Boolean(data.success),
    paid: Boolean(data.paid),
    amountCents: data.amount,
    paidAmountCents: data.paid_amount,
    captureMethod: data.capture_method,
  };
}
