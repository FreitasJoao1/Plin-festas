import { Order } from "./types";
import { formatBRL, SHIPPING_METHOD_LABELS, DELIVERY_CITY_LABELS } from "./shipping";

// Número oficial da Plin Designs
const WA_NUMBER = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5571993008464";

/**
 * Monta a mensagem formatada que vai no WhatsApp ao finalizar o pedido.
 */
export function buildWhatsAppMessage(order: Order): string {
  const itemLines = order.items
    .map(
      (i) =>
        `  • ${i.quantity}× ${i.name} — ${formatBRL(i.unit_price_cents * i.quantity)}`
    )
    .join("\n");

  const shipping =
    order.shipping_cents === 0
      ? "A combinar"
      : formatBRL(order.shipping_cents);

  const shippingLabel =
    SHIPPING_METHOD_LABELS[order.shipping_method] +
    (order.shipping_city ? ` — ${DELIVERY_CITY_LABELS[order.shipping_city]}` : "");

  const lines = [
    `🎉 *Novo pedido — Plin Designs*`,
    ``,
    `📋 *Código:* ${order.order_code}`,
    ``,
    `👤 *Cliente:* ${order.customer_name}`,
    `📞 *Telefone:* ${order.customer_phone}`,
    `📧 *E-mail:* ${order.customer_email}`,
    ``,
    `🛍️ *Itens:*`,
    itemLines,
    ``,
    `🚚 *Entrega:* ${shippingLabel}`,
    `   Frete: ${shipping}`,
    ``,
    `💰 *Subtotal:* ${formatBRL(order.subtotal_cents)}`,
    `💰 *Total:* ${formatBRL(order.total_cents)}`,
    order.note ? `\n📝 *Obs:* ${order.note}` : "",
    order.booking_date
      ? `\n📅 *Data solicitada:* ${new Date(order.booking_date + "T12:00:00").toLocaleDateString("pt-BR")}\n_Sujeito à confirmação de agenda — entraremos em contato caso não seja possível atender nessa data._`
      : "",
    ``,
    `_Pedido enviado pelo site plin-festas-zeta.vercel.app_`,
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  return lines;
}

/**
 * Retorna a URL `wa.me` para redirecionamento direto no WhatsApp do vendedor.
 */
export function buildWhatsAppUrl(order: Order): string {
  const msg = buildWhatsAppMessage(order);
  return `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`;
}
