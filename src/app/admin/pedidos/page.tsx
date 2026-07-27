"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Search,
  Filter,
  X,
  Eye,
  Clock,
  TrendingUp,
  ShoppingBag,
  RefreshCw,
  Check,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// Interface do Pedido
interface Pedido {
  id: string;
  cliente_nome: string;
  cliente_email: string;
  cliente_telefone: string;
  data: string; // ISO ou YYYY-MM-DD
  valor_total: number;
  status: "Pendente" | "Pago" | "Em Produção" | "Enviado" | "Concluído" | "Cancelado";
  itens_count?: number;
}

export default function AdminConsultaPedidos() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Estados dos Filtros
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("TODOS");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const supabase = createClient();

  // 1. Carregar Pedidos do Supabase
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
        // Mapeia os dados do Supabase para a estrutura do componente
        const formatados: Pedido[] = data.map((item: any) => ({
          id: item.code || item.id.substring(0, 8).toUpperCase(),
          cliente_nome: item.customer_name || item.profiles?.full_name || "Cliente",
          cliente_email: item.customer_email || item.profiles?.email || "Sem e-mail",
          cliente_telefone: item.customer_phone || item.profiles?.phone || "-",
          data: item.created_at ? item.created_at.split("T")[0] : new Date().toISOString().split("T")[0],
          valor_total: (item.total_cents || item.total_amount || 0) / 100,
          status: item.status || "Pendente",
          itens_count: item.items ? (Array.isArray(item.items) ? item.items.length : 1) : 1,
        }));
        setPedidos(formatados);
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

  // 2. Atualizar Status do Pedido no Supabase
  async function handleStatusChange(pedidoId: string, novoStatus: string) {
    setUpdatingId(pedidoId);
    if (supabase) {
      const { error } = await supabase
        .from("orders")
        .update({ status: novoStatus })
        .eq("code", pedidoId);

      if (error) {
        // Tenta atualizar por ID caso o 'code' não seja a chave primária
        await supabase
          .from("orders")
          .update({ status: novoStatus })
          .eq("id", pedidoId);
      }
    }

    // Atualiza estado local imediatamente
    setPedidos((prev) =>
      prev.map((p) =>
        p.id === pedidoId ? { ...p, status: novoStatus as Pedido["status"] } : p
      )
    );
    setUpdatingId(null);
  }

  // 3. Busca em Tempo Real (Filtragem instantânea com useMemo)
  const pedidosFiltrados = useMemo(() => {
    return pedidos.filter((pedido) => {
      const term = searchTerm.trim().toLowerCase();

      const dataFormatada = new Date(pedido.data + "T00:00:00").toLocaleDateString("pt-BR");
      const valorStr = pedido.valor_total.toFixed(2).replace(".", ",");
      const valorRawStr = pedido.valor_total.toString();

      // Busca Textual Universal
      const matchSearch =
        term === "" ||
        pedido.id.toLowerCase().includes(term) ||
        pedido.cliente_nome.toLowerCase().includes(term) ||
        pedido.cliente_email.toLowerCase().includes(term) ||
        pedido.cliente_telefone.toLowerCase().includes(term) ||
        pedido.status.toLowerCase().includes(term) ||
        dataFormatada.includes(term) ||
        pedido.data.includes(term) ||
        valorStr.includes(term) ||
        valorRawStr.includes(term);

      // Filtro por Status Select
      const matchStatus =
        selectedStatus === "TODOS" || pedido.status === selectedStatus;

      // Filtro por Data
      const matchDate =
        selectedDate === "" || pedido.data === selectedDate;

      return matchSearch && matchStatus && matchDate;
    });
  }, [pedidos, searchTerm, selectedStatus, selectedDate]);

  // Cálculos de Resumo
  const totalFaturado = useMemo(() => {
    return pedidosFiltrados
      .filter((p) => p.status !== "Cancelado")
      .reduce((acc, curr) => acc + curr.valor_total, 0);
  }, [pedidosFiltrados]);

  const clearFilters = () => {
    setSearchTerm("");
    setSelectedStatus("TODOS");
    setSelectedDate("");
  };

  const getStatusBadge = (status: Pedido["status"]) => {
    switch (status) {
      case "Pendente":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "Pago":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "Em Produção":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "Enviado":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "Concluído":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "Cancelado":
        return "bg-rose-100 text-rose-800 border-rose-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
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
            {totalFaturado.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
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
            {pedidosFiltrados.filter((p) => p.status === "Pendente" || p.status === "Em Produção").length}
          </p>
        </div>
      </div>

      {/* Painel de Filtros e Busca */}
      <div className="rounded-2xl border border-pink-100 bg-white p-4 sm:p-6 shadow-sm space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          {/* Campo de Busca Universal */}
          <div className="relative md:col-span-6">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 pointer-events-none text-ink-soft">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Digite nome, e-mail, código (ex: PLN-1234), valor ou data..."
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

          {/* Filtro por Status */}
          <div className="md:col-span-3">
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-pink-200 bg-pink-50/30 px-3 py-2.5 text-xs sm:text-sm text-ink focus:border-pink-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
            >
              <option value="TODOS">Todos os Status</option>
              <option value="Pendente">Pendente</option>
              <option value="Pago">Pago</option>
              <option value="Em Produção">Em Produção</option>
              <option value="Enviado">Enviado</option>
              <option value="Concluído">Concluído</option>
              <option value="Cancelado">Cancelado</option>
            </select>
          </div>

          {/* Filtro por Data */}
          <div className="relative md:col-span-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full rounded-xl border border-pink-200 bg-pink-50/30 px-3 py-2.5 text-xs sm:text-sm text-ink focus:border-pink-500 focus:bg-white focus:outline-none transition-all cursor-pointer"
            />
          </div>
        </div>

        {/* Tags de Filtros Ativos */}
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
                  {selectedStatus}
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
                  <th className="py-3.5 px-4 font-bold text-right">Alterar Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-pink-100">
                {pedidosFiltrados.map((pedido) => (
                  <tr key={pedido.id} className="hover:bg-pink-50/30 transition-colors">
                    {/* Código */}
                    <td className="py-4 px-4 font-mono font-bold text-pink-600">
                      {pedido.id}
                    </td>

                    {/* Cliente */}
                    <td className="py-4 px-4">
                      <div className="font-semibold text-ink">{pedido.cliente_nome}</div>
                      <div className="text-xs text-ink-soft">
                        {pedido.cliente_email} {pedido.cliente_telefone !== "-" && `• ${pedido.cliente_telefone}`}
                      </div>
                    </td>

                    {/* Data */}
                    <td className="py-4 px-4 whitespace-nowrap text-ink-soft">
                      {new Date(pedido.data + "T00:00:00").toLocaleDateString("pt-BR")}
                    </td>

                    {/* Valor */}
                    <td className="py-4 px-4 whitespace-nowrap font-bold text-ink">
                      {pedido.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${getStatusBadge(pedido.status)}`}>
                        {pedido.status}
                      </span>
                    </td>

                    {/* Seletor de Alteração de Status */}
                    <td className="py-4 px-4 whitespace-nowrap text-right">
                      <select
                        value={pedido.status}
                        disabled={updatingId === pedido.id}
                        onChange={(e) => handleStatusChange(pedido.id, e.target.value)}
                        className="rounded-xl border border-pink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink shadow-sm focus:border-pink-500 focus:outline-none transition-all cursor-pointer hover:border-pink-300 disabled:opacity-50"
                      >
                        <option value="Pendente">Pendente</option>
                        <option value="Pago">Pago</option>
                        <option value="Em Produção">Em Produção</option>
                        <option value="Enviado">Enviado</option>
                        <option value="Concluído">Concluído</option>
                        <option value="Cancelado">Cancelado</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          /* Estado Vazio */
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
