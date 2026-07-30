import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/orders";
import { formatBRL, SHIPPING_METHOD_LABELS, DELIVERY_CITY_LABELS } from "@/lib/shipping";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import OrderStatusForm from "@/components/admin/OrderStatusForm";
import BookingApprovalPanel from "@/components/admin/BookingApprovalPanel";
import { MessageCircle } from "lucide-react";
import { buildCustomerWhatsAppUrl } from "@/lib/whatsapp";

export const metadata = { title: "Detalhe do pedido — Admin Plin Designs" };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrderById(id);
  if (!order) notFound();

  const waUrl = order.customer_phone ? buildCustomerWhatsAppUrl(order.customer_phone) : null;

  return (
    <div className="max-w-2xl">
      {/* Cabeçalho */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-ink-soft">Código do pedido</p>
          <h1 className="font-display text-3xl text-ink">{order.order_code}</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {new Date(order.created_at).toLocaleDateString("pt-BR", {
              day: "2-digit", month: "long", year: "numeric",
              hour: "2-digit", minute: "2-digit",
            })}
          </p>
        </div>
        <OrderStatusBadge status={order.status} />
      </div>

      {/* Botão abrir no WhatsApp — só aparece se o pedido tem telefone do cliente */}
      {waUrl && (
        <a
          href={waUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-2 rounded-full bg-green-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-600"
        >
          <MessageCircle className="h-4 w-4" />
          Abrir conversa no WhatsApp
        </a>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {/* Cliente */}
        <div className="rounded-3xl border border-pink-100 bg-white p-6">
          <h2 className="font-semibold text-ink">👤 Cliente</h2>
          <div className="mt-2 grid gap-1 text-sm text-ink-soft">
            <p><span className="font-medium text-ink">Nome:</span> {order.customer_name}</p>
            <p><span className="font-medium text-ink">WhatsApp:</span> {order.customer_phone}</p>
            {order.customer_email && (
              <p><span className="font-medium text-ink">E-mail:</span> {order.customer_email}</p>
            )}
          </div>
        </div>

        {/* Itens */}
        <div className="rounded-3xl border border-pink-100 bg-white p-6">
          <h2 className="font-semibold text-ink">🛍️ Itens do pedido</h2>
          <ul className="mt-3 flex flex-col divide-y divide-pink-50">
            {order.items.map((item) => (
              <li key={item.product_id} className="flex items-center justify-between py-2 text-sm">
                <span className="text-ink">
                  <span className="font-semibold">{item.quantity}×</span> {item.name}
                </span>
                <span className="text-ink-soft">
                  {formatBRL(item.unit_price_cents * item.quantity)}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-col gap-1 border-t border-pink-100 pt-3 text-sm">
            <div className="flex justify-between text-ink-soft">
              <span>Subtotal</span>
              <span>{formatBRL(order.subtotal_cents)}</span>
            </div>
            {order.discount_cents > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Cupom {order.coupon_code ? `(${order.coupon_code})` : ""}</span>
                <span>-{formatBRL(order.discount_cents)}</span>
              </div>
            )}
            <div className="flex justify-between text-ink-soft">
              <span>
                Frete ({SHIPPING_METHOD_LABELS[order.shipping_method]}
                {order.shipping_city ? ` — ${DELIVERY_CITY_LABELS[order.shipping_city]}` : ""})
              </span>
              <span>{order.shipping_cents === 0 ? "A combinar" : formatBRL(order.shipping_cents)}</span>
            </div>
            <div className="mt-1 flex justify-between text-base font-bold text-ink">
              <span>Total</span>
              <span>{formatBRL(order.total_cents)}</span>
            </div>
          </div>
        </div>

        {/* Pagamento (só aparece se o cliente pagou/tentou pagar online) */}
        {order.payment_status !== "none" && (
          <div className="rounded-3xl border border-pink-100 bg-white p-6">
            <h2 className="font-semibold text-ink">💳 Pagamento online</h2>
            <div className="mt-2 grid gap-1 text-sm text-ink-soft">
              <p>
                <span className="font-medium text-ink">Status:</span>{" "}
                {order.payment_status === "paid" && <span className="font-semibold text-emerald-600">✅ Pago</span>}
                {order.payment_status === "pending" && <span className="font-semibold text-amber-600">⏳ Aguardando pagamento</span>}
                {order.payment_status === "failed" && <span className="font-semibold text-red-600">❌ Falhou</span>}
              </p>
              {order.payment_method && (
                <p><span className="font-medium text-ink">Método:</span> {order.payment_method === "pix" ? "Pix" : "Cartão de crédito"}</p>
              )}
              {order.infinitepay_paid_amount_cents != null && (
                <p><span className="font-medium text-ink">Valor pago:</span> {formatBRL(order.infinitepay_paid_amount_cents)}</p>
              )}
              {order.infinitepay_transaction_nsu && (
                <p className="font-mono text-xs">Transação: {order.infinitepay_transaction_nsu}</p>
              )}
            </div>
          </div>
        )}

        {/* Observação */}
        {order.note && (
          <div className="rounded-3xl border border-amber-100 bg-amber-50 p-6">
            <h2 className="font-semibold text-ink">📝 Observação do cliente</h2>
            <p className="mt-2 text-sm text-ink-soft">{order.note}</p>
          </div>
        )}

        {/* Agendamento (só aparece se o cliente escolheu uma data) */}
        <BookingApprovalPanel order={order} />

        {/* Status */}
        <div className="rounded-3xl border border-pink-100 bg-white p-6">
          <h2 className="font-semibold text-ink">Atualizar status</h2>
          <div className="mt-3">
            <OrderStatusForm order={order} />
          </div>
        </div>
      </div>
    </div>
  );
}
