"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Search,
  Filter,
  X,
  Eye,
  Clock,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
  MessageCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Order, OrderStatus } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";
import { buildCustomerWhatsAppUrl } from "@/lib/whatsapp";
import OrderStatusBadge from "@/components/OrderStatusBadge";

// Mesmo enum de status usado no resto do projeto (OrderStatusBadge,
// OrderStatusForm, schema.sql) — nada de valores em português criados à
// parte, que não existem no banco.
const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "novo", label: "🆕 Novo" },
  { value: "confirmado", label: "✅ Confirmado" },
  { value: "em_producao", label: "🏭 Em produção" },
  { value: "pronto", label: "📦 Pronto" },
  { value: "enviado", label: "🚚 Enviado" },
  { value: "entregue", label: "🎉 Entregue" },
  { value: "cancelado", label: "❌ Cancelado" },
];

// Pedido cancelado nunca entra em faturamento — igual ao critério já
// usado em getOrderMetrics() (src/lib/orders.ts) para o dashboard.
const REVENUE_STATUSES: OrderStatus[] = [
  "confirmado", "em_producao", "pronto", "enviado", "entregue",
];

export default function AdminConsultaPedidos() {
  const [pedidos, setPedidos] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const supabase = createClient();

  async function fetchPedidos() {
    setLoading(true);
    if (!supabase) {
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Erro ao buscar pedidos:", error);
      } else if (data) {
        setPedidos(data as Order[]);
      }
    } catch (err) {
      console.error("Erro inesperado:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPedidos();
  }, []);

  // Atualiza status pela mesma rota /api/admin/pedidos/[id] usada na tela
  // de detalhe do pedido (requireAdmin + updateOrderStatus) — em vez de
  // um update direto do client, que não passa pela mesma validação.
  async function handleStatusChange(orderId: string, novoStatus: OrderStatus) {
    setUpdatingId(orderId);
    try {
      const res = await fetch(`/api/admin/pedidos/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus }),
      });
      if (res.ok) {
        setPedidos((prev) =>
          prev.map((p) => (p.id === orderId ? { ...p, status: novoStatus } : p))
        );
      } else {
        const data = await res.json().catch(() => null);
        console.error("Erro ao atualizar status:", data?.error);
      }
    } catch (err) {
      console.error("Erro de conexão ao atualizar status:", err);
    } finally {
      setUpdatingId(null);
    }
  }

  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((pedido) => {
      const term = searchTerm.trim().toLowerCase();
      const dataISO = pedido.created_at.slice(0, 10);
      const dataFormatada = new Date(dataISO + "T00:00:00").toLocaleDateString("pt-BR");
      const valorStr = (pedido.total_cents / 100).toFixed(2).replace(".", ",");

      const matchSearch =
        term === "" ||
        pedido.order_code.toLowerCase().includes(term) ||
        pedido.customer_name.toLowerCase().includes(term) ||
        pedido.customer_email.toLowerCase().includes(term) ||
        pedido.customer_phone.toLowerCase().includes(term) ||
        pedido.status.toLowerCase().includes(term) ||
        dataFormatada.includes(term) ||
        dataISO.includes(term) ||
        valorStr.includes(term);

      const matchStatus = selectedStatus === "TODOS" || pedido.status === selectedStatus;
      const matchDate = selectedDate === "" || dataISO === selectedDate;

      return matchSearch && matchStatus && matchDate;
    });
  }, [pedidos, searchTerm, selectedStatus, selectedDate]);

  const totalFaturado = useMemo(() => {
    return pedidosFiltrados
      .filter((p) => REVENUE_STATUSES.includes(p.status))
      .reduce((acc, curr) => acc + curr.total_cents, 0);
  }, [pedidosFiltrados]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("TODOS");
    setSelectedDate("");
  };

  return (
    <div className="container-plin py-8 space-y-6">
      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-pink-100 pb-5">
        <div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-ink">
            Consulta de Pedidos
          </h1>
          <p className="text-xs sm:text-sm text-ink-soft mt-1">
            Pesquise por nome, código, valor, data ou status em tempo real.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchPedidos}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full border border-pink-200 bg-white px-3 py-2 text-xs font-semibold text-pink-600 transition-all hover:bg-pink-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </button>

          <div className="inline-flex items-center gap-2 rounded-full bg-pink-50 px-4 py-2 text-xs font-semibold text-pink-600 border border-pink-100">
            <ShoppingBag className="h-4 w-4" />
            <span>{pedidosFiltrados.length} pedidos</span>
          </div>
        </div>
      </div>

      {/* Cartões de Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Resultados Filtrados</span>
            <div className="rounded-xl bg-pink-100 p-2 text-pink-600">
              <Filter className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{pedidosFiltrados.length}</p>
        </div>

        <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Faturamento Exibido</span>
            <div className="rounded-xl bg-emerald-100 p-2 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-emerald-600">
            {formatBRL(totalFaturado)}
          </p>
          <p className="mt-0.5 text-[11px] text-ink-soft">
            Não conta pedidos cancelados nem "novo" (ainda não confirmado)
          </p>
        </div>

        <div className="rounded-2xl border border-pink-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink-soft">Em Aberto / Produção</span>
            <div className="rounded-xl bg-purple-100 p-2 text-purple-600">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <p className="mt-2 text-2xl font-bold text-purple-600">
            {pedidosFiltrados.filter((p) => p.status === "novo" || p.status === "em_producao").length}
          </p>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="rounded-2xl border border-pink-100 bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="relative md:col-span-6">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-ink-soft">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite nome, e-mail, código (ex: PLN-0728-A3K), valor ou data..."
              className="w-full rounded-xl border border-pink-200 bg-pink-50/30 pl-10 pr-9 py-2.5 text-xs sm:text-sm text-ink placeholder-ink-soft/60 focus:border-pink-500 focus:bg-white focus:outline-none transition-all"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm("")}
                className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-soft hover:text-pink-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-pink-200 bg-pink-50/30 px-3 py-2.5 text-xs sm:text-sm text-ink focus:border-pink-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="relative md:col-span-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-pink-200 bg-pink-50/30 px-3 py-2.5 text-xs sm:text-sm text-ink focus:border-pink-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
            />
          </div>
        </div>

        {(searchTerm || selectedStatus !== "TODOS" || selectedDate) && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-pink-100 text-xs">
            <div className="flex flex-wrap items-center gap-2 text-ink-soft">
              <span className="font-semibold">Filtros ativos:</span>
              {searchTerm && (
                <span className="rounded-lg bg-pink-100 px-2.5 py-1 text-pink-700 font-medium">
                  "{searchTerm}"
                </span>
              )}
              {selectedStatus !== "TODOS" && (
                <span className="rounded-lg bg-pink-100 px-2.5 py-1 text-pink-700 font-medium">
                  {STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.label ?? selectedStatus}
                </span>
              )}
              {selectedDate && (
                <span className="rounded-lg bg-pink-100 px-2.5 py-1 text-pink-700 font-medium">
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>

            <button
              onClick={clearFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold text-pink-600 hover:text-pink-700 hover:underline"
            >
              <X className="h-3.5 w-3.5" /> Limpar Filtros
            </button>
          </div>
        )}
      </div>

      {/* Tabela de Pedidos */}
      <div className="rounded-2xl border border-pink-100 bg-white shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-ink-soft">
            <RefreshCw className="mx-auto h-8 w-8 animate-spin text-pink-500 mb-2" />
            <p className="text-xs font-medium">Carregando pedidos do banco de dados...</p>
          </div>
        ) : pedidosFiltrados.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs sm:text-sm text-ink">
              <thead className="bg-pink-50/70 border-b border-pink-100 text-xs uppercase tracking-wider text-ink-soft">
                <tr>
                  <th className="py-3.5 px-4 font-bold">Código</th>
                  <th className="py-3.5 px-4 font-bold">Cliente</th>
                  <th className="py-3.5 px-4 font-bold">Data</th>
                  <th className="py-3.5 px-4 font-bold">Valor</th>
                  <th className="py-3.5 px-4 font-bold">Status</th>
                  <th className="py-3.5 px-4 font-bold text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100">
                {pedidosFiltrados.map((pedido) => {
                  const waUrl = pedido.customer_phone
                    ? buildCustomerWhatsAppUrl(pedido.customer_phone)
                    : null;
                  return (
                    <tr key={pedido.id} className="hover:bg-pink-50/30 transition-colors">
                      <td className="py-4 px-4 font-mono font-bold text-pink-600">
                        {pedido.order_code}
                      </td>

                      <td className="py-4 px-4">
                        <div className="font-semibold text-ink">{pedido.customer_name}</div>
                        <div className="text-xs text-ink-soft">
                          {pedido.customer_email || "Sem e-mail"}
                          {pedido.customer_phone && ` • ${pedido.customer_phone}`}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-ink-soft">
                        {new Date(pedido.created_at).toLocaleDateString("pt-BR")}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap font-bold text-ink">
                        {formatBRL(pedido.total_cents)}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <OrderStatusBadge status={pedido.status} />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {/* WhatsApp do CLIENTE — só aparece se o pedido tem telefone */}
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              title="Falar com o cliente no WhatsApp"
                              className="inline-flex items-center justify-center rounded-xl border border-green-200 bg-green-50 p-2 text-green-600 transition-colors hover:bg-green-100"
                            >
                              <MessageCircle className="h-4 w-4" />
                            </a>
                          )}

                          {/* Ver todos os detalhes do pedido */}
                          <Link
                            href={`/admin/pedidos/${pedido.id}`}
                            title="Ver detalhes do pedido"
                            className="inline-flex items-center justify-center rounded-xl border border-pink-200 bg-white p-2 text-pink-600 transition-colors hover:bg-pink-50"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>

                          <select
                            value={pedido.status}
                            disabled={updatingId === pedido.id}
                            onChange={(e) => handleStatusChange(pedido.id, e.target.value as OrderStatus)}
                            className="rounded-xl border border-pink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm focus:border-pink-500 focus:outline-none transition-all cursor-pointer hover:border-pink-300 disabled:opacity-50"
                          >
                            {STATUS_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-12 px-4 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-pink-600 mb-3">
              <Search className="h-6 w-6" />
            </div>
            <h3 className="text-base font-bold text-ink">Nenhum pedido encontrado</h3>
            <p className="text-xs text-ink-soft mt-1 max-w-sm mx-auto">
              Não encontramos resultados para a sua busca atual. Tente alterar o termo ou limpar os filtros.
            </p>
            <button
              onClick={clearFilters}
              className="mt-4 rounded-full bg-pink-500 px-5 py-2 text-xs font-semibold text-white hover:bg-lilac-500 transition-colors"
            >
              Limpar Filtros e Ver Todos
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
