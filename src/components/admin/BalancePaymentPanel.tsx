"use client";

import { useState } from "react";
import { Copy, Check, MessageCircle } from "lucide-react";
import { Order } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";
import { buildCustomerWhatsAppUrl } from "@/lib/whatsapp";

const STATUS_LABEL: Record<Order["balance_payment_status"], { label: string; classes: string }> = {
  none: { label: "Ainda não cobrado", classes: "bg-gray-50 text-gray-600" },
  pending: { label: "⏳ Link gerado, aguardando", classes: "bg-amber-50 text-amber-700" },
  paid: { label: "✅ Saldo pago", classes: "bg-emerald-50 text-emerald-700" },
  failed: { label: "❌ Falhou", classes: "bg-red-50 text-red-700" },
};

/** Só renderiza para pedidos com pagamento fracionado 50/50 (payment_plan='split_50_50'). */
export default function BalancePaymentPanel({ order }: { order: Order }) {
  const [link, setLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (order.payment_plan !== "split_50_50") return null;

  const status = STATUS_LABEL[order.balance_payment_status];

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/link-saldo`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao gerar link."); return; }
      setLink(data.url);
    } catch {
      setError("Erro de conexão.");
    } finally {
      setLoading(false);
    }
  }

  function handleCopy() {
    if (!link) return;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="rounded-3xl border border-pink-100 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">💰 Pagamento fracionado (50/50)</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status.classes}`}>
          {status.label}
        </span>
      </div>
      <div className="mt-2 grid gap-1 text-sm text-ink-soft">
        <p><span className="font-medium text-ink">Sinal (já cobrado no checkout):</span> {formatBRL(order.deposit_amount_cents)}</p>
        <p><span className="font-medium text-ink">Saldo devedor (cobrar na entrega):</span> {formatBRL(order.balance_amount_cents)}</p>
      </div>

      {order.balance_payment_status !== "paid" && (
        <div className="mt-4">
          <button
            onClick={handleGenerate}
            disabled={loading}
            className="rounded-full bg-lilac-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-lilac-600 disabled:opacity-60"
          >
            {loading ? "Gerando…" : "Gerar link de cobrança do saldo"}
          </button>
          {link && (
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-pink-100 bg-pink-50/50 p-3">
              <span className="flex-1 truncate text-xs text-ink">{link}</span>
              <button
                onClick={handleCopy}
                className="flex-shrink-0 rounded-full p-1.5 text-pink-600 transition-colors hover:bg-pink-100"
                aria-label="Copiar link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </button>
              <a
                href={buildCustomerWhatsAppUrl(
                  order.customer_phone,
                  `Oi, ${order.customer_name}! Seu pedido ${order.order_code} está pronto 🎉\n` +
                    `Falta só o saldo de ${formatBRL(order.balance_amount_cents)} para a entrega.\n` +
                    `Pode pagar por aqui: ${link}`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-shrink-0 rounded-full bg-green-500 p-1.5 text-white transition-colors hover:bg-green-600"
                aria-label="Enviar no WhatsApp"
              >
                <MessageCircle className="h-4 w-4" />
              </a>
            </div>
          )}
          {error && <p className="mt-2 text-sm text-pink-700">{error}</p>}
        </div>
      )}
    </div>
  );
}
