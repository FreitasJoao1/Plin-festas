"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PartyPopper, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatBRL } from "@/lib/shipping";

interface Toast {
  id: string;
  orderId: string;
  orderCode: string;
  customerName: string;
  totalCents: number;
}

/**
 * Escuta pedidos novos em tempo real (Supabase Realtime, ativado na
 * tabela `orders` pelo schema.sql) e mostra um toast no canto da tela
 * enquanto o admin está navegando pelo painel — sem precisar recarregar
 * a página para saber que chegou um pedido novo.
 */
export default function RealtimeOrdersNotifier() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return; // modo demo: sem realtime

    const channel = supabase
      .channel("admin-orders-feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => {
          const row = payload.new as {
            id: string;
            order_code: string;
            customer_name: string;
            total_cents: number;
          };
          const toast: Toast = {
            id: crypto.randomUUID(),
            orderId: row.id,
            orderCode: row.order_code,
            customerName: row.customer_name,
            totalCents: row.total_cents,
          };
          setToasts((t) => [...t, toast]);
          // Auto-remove depois de 8s
          setTimeout(() => {
            setToasts((t) => t.filter((x) => x.id !== toast.id));
          }, 8000);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="animate-in slide-in-from-bottom-4 flex items-start gap-3 rounded-2xl border border-pink-200 bg-white p-4 shadow-lg"
          style={{ animation: "slideIn 0.3s ease-out" }}
        >
          <div className="rounded-full bg-pink-100 p-2">
            <PartyPopper className="h-5 w-5 text-pink-500" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-ink">Novo pedido! 🎉</p>
            <p className="font-mono text-xs text-ink-soft">{toast.orderCode}</p>
            <p className="text-xs text-ink-soft">
              {toast.customerName} — {formatBRL(toast.totalCents)}
            </p>
            <Link
              href={`/admin/pedidos/${toast.orderId}`}
              className="mt-1 inline-block text-xs font-semibold text-pink-600 hover:text-lilac-500 hover:underline"
              onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))}
            >
              Ver pedido →
            </Link>
          </div>
          <button
            onClick={() => setToasts((t) => t.filter((x) => x.id !== toast.id))}
            className="text-ink-soft transition-colors hover:text-ink"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}

      <style jsx global>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
