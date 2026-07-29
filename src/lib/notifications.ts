import { Order } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";

/**
 * Notificação de recusa de agendamento por e-mail, via Resend.
 *
 * AÇÃO QUE SÓ VOCÊ PODE FAZER: crie uma conta em https://resend.com,
 * gere uma API key e configure RESEND_API_KEY + RESEND_FROM_EMAIL no
 * .env.local. Sem isso, esta função não lança erro — só loga um aviso e
 * não envia nada. A recusa em si (booking_status='rejected' no banco)
 * acontece independente do e-mail funcionar ou não.
 */
export async function sendBookingRejectedEmail(
  order: Order,
  reason: string,
  alternativeDate: string | null
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;

  if (!apiKey || !fromEmail) {
    console.warn(
      "[notifications] RESEND_API_KEY/RESEND_FROM_EMAIL não configurados — e-mail de recusa não enviado. Ver src/lib/notifications.ts."
    );
    return;
  }

  if (!order.customer_email) {
    console.warn(`[notifications] Pedido ${order.order_code} sem e-mail de contato — não enviado.`);
    return;
  }

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || "5571993008464";
  const whatsappMsg = encodeURIComponent(
    `Olá! Sobre o pedido ${order.order_code}: recebi o aviso de que a data não pôde ser confirmada e gostaria de conversar sobre uma nova data.`
  );
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;

  const alternativeLine = alternativeDate
    ? `<p>Sugerimos como alternativa: <strong>${new Date(alternativeDate + "T12:00:00").toLocaleDateString("pt-BR")}</strong>.</p>`
    : "";

  const html = `
    <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
      <h2 style="color: #F2578C;">Sobre o seu pedido ${order.order_code}</h2>
      <p>Olá, ${order.customer_name}! Infelizmente não conseguimos confirmar a data solicitada para o seu pedido.</p>
      <p><strong>Motivo:</strong> ${reason}</p>
      ${alternativeLine}
      <p>Total do pedido: ${formatBRL(order.total_cents)}</p>
      <a href="${whatsappUrl}" style="display:inline-block;background:#25D366;color:#fff;padding:12px 20px;border-radius:24px;text-decoration:none;font-weight:bold;margin-top:12px;">
        Falar no WhatsApp
      </a>
      <p style="color:#888;font-size:12px;margin-top:24px;">Plin Designs</p>
    </div>
  `;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: fromEmail,
      to: order.customer_email,
      subject: `Atualização sobre o seu pedido ${order.order_code}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Resend respondeu ${res.status}: ${text}`);
  }
}
