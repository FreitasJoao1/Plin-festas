import { NextRequest, NextResponse } from "next/server";
import { getOrderById } from "@/lib/orders";
import { checkPayment, isBalanceNsu, BALANCE_NSU_SUFFIX } from "@/lib/infinitepay";
import { markPaymentConfirmed, markBalancePaymentConfirmed } from "@/lib/orders";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Consultada pela página de retorno do checkout (/checkout/pagamento)
 * para saber se o pagamento já foi confirmado. Lê o estado gravado no
 * banco (atualizado pelo webhook) — nunca confia nos query params que a
 * InfinitePay manda no redirect, que não têm garantia de assinatura.
 *
 * Se o webhook ainda não chegou mas o cliente já foi redirecionado com
 * sucesso (slug/transaction_nsu presentes na URL), fazemos uma consulta
 * ativa via payment_check aqui mesmo — cobre o caso do webhook atrasar.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("order");
  const slug = searchParams.get("slug");
  const transactionNsu = searchParams.get("transaction_nsu");

  if (!orderId || !UUID_RE.test(orderId)) {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  if (order.payment_status === "paid" && (order.payment_plan !== "split_50_50" || order.balance_payment_status !== "pending")) {
    return NextResponse.json({
      payment_status: "paid",
      order_code: order.order_code,
      payment_plan: order.payment_plan,
      balance_payment_status: order.balance_payment_status,
    });
  }

  // Webhook pode não ter chegado ainda — se temos slug+transaction_nsu
  // do redirect, confirma agora mesmo (server-to-server) em vez de fazer
  // o cliente ficar recarregando a página. O NSU usado no redirect diz
  // se é o sinal/integral ou o saldo (sufixo -SALDO).
  if (slug && transactionNsu) {
    const isBalance = searchParams.get("leg") === "balance";
    const orderNsu = isBalance ? `${order.order_code}${BALANCE_NSU_SUFFIX}` : order.order_code;
    const confirmation = await checkPayment(orderNsu, transactionNsu, slug);
    if (confirmation?.success && confirmation.paid) {
      if (isBalance) {
        await markBalancePaymentConfirmed(order.order_code, {
          transactionNsu,
          invoiceSlug: slug,
          paidAmountCents: confirmation.paidAmountCents ?? confirmation.amountCents ?? order.balance_amount_cents,
          method: confirmation.captureMethod ?? "pix",
        });
      } else {
        await markPaymentConfirmed(order.order_code, {
          transactionNsu,
          invoiceSlug: slug,
          paidAmountCents: confirmation.paidAmountCents ?? confirmation.amountCents ?? order.total_cents,
          method: confirmation.captureMethod ?? "pix",
        });
      }
      return NextResponse.json({
        payment_status: isBalance ? order.payment_status : "paid",
        balance_payment_status: isBalance ? "paid" : order.balance_payment_status,
        order_code: order.order_code,
        payment_plan: order.payment_plan,
      });
    }
  }

  return NextResponse.json({
    payment_status: order.payment_status,
    balance_payment_status: order.balance_payment_status,
    order_code: order.order_code,
    payment_plan: order.payment_plan,
  });
}
