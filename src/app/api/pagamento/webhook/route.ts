import { NextRequest, NextResponse } from "next/server";
import { checkPayment } from "@/lib/infinitepay";
import { markPaymentConfirmed, getOrderByCode } from "@/lib/orders";

/**
 * Webhook da InfinitePay. A doc oficial não especifica assinatura/HMAC
 * para validar que a chamada realmente veio da InfinitePay — então este
 * endpoint NUNCA confia diretamente no corpo recebido. Ele usa o
 * order_nsu + transaction_nsu + invoice_slug do payload só como pista
 * para ir CONFIRMAR com a própria InfinitePay via payment_check
 * (chamada server-to-server, autenticada pelo nosso handle). Só grava
 * payment_status='paid' se essa confirmação bater.
 *
 * A InfinitePay espera resposta em menos de 1s e reenvia em caso de erro
 * 400 — por isso qualquer coisa que não seja "pedido claramente inválido"
 * retorna 200, para não gerar reenvio infinito por um problema transitório
 * nosso (ex: banco fora do ar por 1s).
 */
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, message: "JSON inválido" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const orderNsu = typeof b.order_nsu === "string" ? b.order_nsu : null;
  const transactionNsu = typeof b.transaction_nsu === "string" ? b.transaction_nsu : null;
  const invoiceSlug = typeof b.invoice_slug === "string" ? b.invoice_slug : null;

  if (!orderNsu || !transactionNsu || !invoiceSlug) {
    // Payload sem os campos mínimos — não é um pedido nosso válido,
    // então recusamos de verdade (a InfinitePay não deveria reenviar
    // algo estruturalmente quebrado).
    return NextResponse.json(
      { success: false, message: "Payload sem order_nsu/transaction_nsu/invoice_slug." },
      { status: 400 }
    );
  }

  const order = await getOrderByCode(orderNsu);
  if (!order) {
    return NextResponse.json({ success: false, message: "Pedido não encontrado." }, { status: 400 });
  }

  // Confirmação real, ignorando o que veio no corpo do webhook em si.
  const confirmation = await checkPayment(orderNsu, transactionNsu, invoiceSlug);

  if (!confirmation) {
    // Falha ao contatar a InfinitePay agora — provável instabilidade
    // transitória nossa/deles. Devolve 200 pra não entrar em reenvio
    // agressivo; se o pagamento for real, o cliente/admin ainda podem
    // acionar a verificação manual depois.
    console.error(`[infinitepay webhook] payment_check falhou para order_nsu=${orderNsu}`);
    return NextResponse.json({ success: true, message: null });
  }

  if (!confirmation.success || !confirmation.paid) {
    // Confirmado com a InfinitePay que NÃO foi pago — não é erro nosso,
    // só não há nada a gravar.
    return NextResponse.json({ success: true, message: null });
  }

  const result = await markPaymentConfirmed(orderNsu, {
    transactionNsu,
    invoiceSlug,
    paidAmountCents: confirmation.paidAmountCents ?? confirmation.amountCents ?? order.total_cents,
    method: confirmation.captureMethod ?? "pix",
  });

  if ("error" in result) {
    console.error(`[infinitepay webhook] falha ao gravar pagamento de ${orderNsu}:`, result.error);
    // Erro nosso de banco — aqui sim vale deixar a InfinitePay reenviar.
    return NextResponse.json({ success: false, message: "Erro interno ao gravar pagamento." }, { status: 400 });
  }

  return NextResponse.json({ success: true, message: null });
}
