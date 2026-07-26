"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Order, OrderStatus } from "@/lib/types";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "novo",        label: "🆕 Novo" },
  { value: "confirmado",  label: "✅ Confirmado" },
  { value: "em_producao", label: "🏭 Em produção" },
  { value: "pronto",      label: "📦 Pronto" },
  { value: "enviado",     label: "🚚 Enviado" },
  { value: "entregue",    label: "🎉 Entregue" },
  { value: "cancelado",   label: "❌ Cancelado" },
];

export default function OrderStatusForm({ order }: { order: Order }) {
  const router = useRouter();
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/admin/pedidos/${order.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Erro ao atualizar."); return; }
      setSaved(true);
      router.refresh();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as OrderStatus); setSaved(false); }}
          className="rounded-xl border border-pink-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-pink-500"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={saving || status === order.status}
          className="rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lilac-500 disabled:opacity-60"
        >
          {saving ? "Salvando…" : "Atualizar"}
        </button>
        {saved && <span className="text-sm text-green-600">✓ Salvo</span>}
      </div>
      {error && <p className="text-sm text-pink-700">{error}</p>}
    </div>
  );
}
