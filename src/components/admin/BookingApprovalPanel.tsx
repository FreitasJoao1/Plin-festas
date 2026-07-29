"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, CalendarX, X } from "lucide-react";
import { Order } from "@/lib/types";

const BOOKING_LABEL: Record<Order["booking_status"], { label: string; classes: string }> = {
  pending_approval: { label: "⏳ Aguardando confirmação", classes: "bg-amber-50 text-amber-700" },
  approved: { label: "✅ Data aprovada", classes: "bg-emerald-50 text-emerald-700" },
  rejected: { label: "❌ Data recusada", classes: "bg-red-50 text-red-700" },
};

export default function BookingApprovalPanel({ order }: { order: Order }) {
  const router = useRouter();
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [reason, setReason] = useState("");
  const [alternativeDate, setAlternativeDate] = useState("");
  const [needsRefund, setNeedsRefund] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!order.booking_date) return null;

  const bookingLabel = BOOKING_LABEL[order.booking_status];
  const formattedDate = new Date(order.booking_date + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  async function handleApprove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/aprovar`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao aprovar."); return; }
      router.refresh();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  async function handleReject() {
    if (!reason.trim()) {
      setError("A justificativa é obrigatória.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}/recusar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reason.trim(),
          alternativeDate: alternativeDate || undefined,
          needsRefund,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao recusar."); return; }
      setShowRejectModal(false);
      router.refresh();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-3xl border border-pink-100 bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-ink">📅 Agendamento</h2>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${bookingLabel.classes}`}>
          {bookingLabel.label}
        </span>
      </div>

      <p className="mt-2 text-sm text-ink-soft">
        Data solicitada: <span className="font-medium text-ink">{formattedDate}</span>
      </p>

      {order.refund_status === "refund_pending" && (
        <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
          ⚠️ Realizar estorno manual deste pedido (Pix/combinado por fora — não há gateway de pagamento integrado).
        </p>
      )}

      {order.booking_status === "rejected" && order.booking_rejection_reason && (
        <div className="mt-3 rounded-xl bg-gray-50 px-3 py-2 text-xs text-ink-soft">
          <p><span className="font-semibold text-ink">Motivo da recusa:</span> {order.booking_rejection_reason}</p>
          {order.booking_alternative_date && (
            <p className="mt-1">
              <span className="font-semibold text-ink">Data alternativa sugerida:</span>{" "}
              {new Date(order.booking_alternative_date + "T12:00:00").toLocaleDateString("pt-BR")}
            </p>
          )}
        </div>
      )}

      {order.booking_status === "pending_approval" && (
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            onClick={handleApprove}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
          >
            <CalendarCheck className="h-4 w-4" />
            Aprovar data
          </button>
          <button
            onClick={() => setShowRejectModal(true)}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-full border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-60"
          >
            <CalendarX className="h-4 w-4" />
            Recusar pedido
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-pink-700">{error}</p>}

      {/* Modal de recusa — justificativa obrigatória + data alternativa (spec 2.2) */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg text-ink">Recusar pedido</h3>
              <button onClick={() => setShowRejectModal(false)} aria-label="Fechar">
                <X className="h-5 w-5 text-ink-soft" />
              </button>
            </div>

            <label className="mt-4 block text-sm font-medium text-ink">
              Justificativa da recusa *
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex: indisponibilidade de insumos, incompatibilidade de prazo…"
              rows={3}
              className="mt-1 w-full rounded-2xl border border-pink-200 px-4 py-3 text-sm outline-none focus:border-pink-500"
            />

            <label className="mt-4 block text-sm font-medium text-ink">
              Nova data alternativa (opcional)
            </label>
            <input
              type="date"
              value={alternativeDate}
              onChange={(e) => setAlternativeDate(e.target.value)}
              className="mt-1 w-full rounded-2xl border border-pink-200 px-4 py-3 text-sm outline-none focus:border-pink-500"
            />

            <label className="mt-4 flex items-center gap-2 text-sm text-ink">
              <input
                type="checkbox"
                checked={needsRefund}
                onChange={(e) => setNeedsRefund(e.target.checked)}
                className="h-4 w-4 rounded border-pink-300"
              />
              Este pedido já recebeu pagamento e precisa de estorno manual
            </label>

            {error && <p className="mt-3 text-sm text-pink-700">{error}</p>}

            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="rounded-full border border-pink-200 px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:bg-pink-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={saving}
                className="rounded-full bg-red-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-600 disabled:opacity-60"
              >
                {saving ? "Salvando…" : "Confirmar recusa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
