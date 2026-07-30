"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import BookingCalendar, {
  WeekOccupancyData,
  DayStatusOverrideData,
  DayStatusValue,
} from "@/components/BookingCalendar";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import ManualOrderModal from "@/components/admin/ManualOrderModal";
import { Order } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";

function mondayOf(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00");
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatLong(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
  });
}

const BOOKING_LABEL: Record<Order["booking_status"], string> = {
  pending_approval: "⏳ Aguardando",
  approved: "✅ Aprovado",
  rejected: "❌ Recusado",
};

const DAY_STATUS_OPTIONS: { value: DayStatusValue; label: string }[] = [
  { value: "available", label: "Disponível (calculado normalmente)" },
  { value: "limited", label: "Vagas limitadas (forçar aparência)" },
  { value: "full", label: "Esgotado (bloqueia agendamento neste dia)" },
  { value: "blocked", label: "Bloqueado / fora de serviço" },
];

export default function AdminAgendaPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => mondayOf(today));
  const [occupancies, setOccupancies] = useState<WeekOccupancyData[]>([]);
  const [dayStatusOverrides, setDayStatusOverrides] = useState<DayStatusOverrideData[]>([]);
  const [horizonDays, setHorizonDays] = useState(180);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // null = visualizando a semana inteira; senão, filtrando por um dia específico.
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Edição de cota da semana visível.
  const [capacityInput, setCapacityInput] = useState("");
  const [savingCapacity, setSavingCapacity] = useState(false);

  // Edição de status do dia selecionado.
  const [savingDayStatus, setSavingDayStatus] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [showManualOrderModal, setShowManualOrderModal] = useState(false);

  const load = useCallback((weekStart: string) => {
    setLoading(true);
    const start = weekStart;
    const end = addDays(weekStart, 6);
    fetch(`/api/admin/agenda?start=${start}&end=${end}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.weeks) setOccupancies(data.weeks);
        if (data.settings?.horizon_days) setHorizonDays(data.settings.horizon_days);
        if (data.orders) setOrders(data.orders);
        if (data.dayStatuses) setDayStatusOverrides(data.dayStatuses);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(visibleWeekStart);
    setSelectedDay(null);
  }, [visibleWeekStart, load]);

  const weekData = occupancies.find((w) => w.week_start === visibleWeekStart);

  useEffect(() => {
    setCapacityInput(weekData ? String(weekData.capacity) : "");
  }, [weekData]);

  const selectedDayStatus = useMemo(
    () => dayStatusOverrides.find((o) => o.date === selectedDay)?.status ?? "available",
    [dayStatusOverrides, selectedDay]
  );

  const visibleOrders = useMemo(
    () => (selectedDay ? orders.filter((o) => o.booking_date === selectedDay) : orders),
    [orders, selectedDay]
  );

  async function saveCapacity() {
    const parsed = capacityInput.trim() === "" ? null : Number(capacityInput);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed <= 0)) {
      setFeedback("Capacidade deve ser um número inteiro maior que zero.");
      return;
    }
    setSavingCapacity(true);
    setFeedback(null);
    const res = await fetch("/api/admin/agenda/week-capacity", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ week_start: visibleWeekStart, capacity: parsed }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingCapacity(false);
    if (!res.ok) {
      setFeedback(data.error ?? "Erro ao salvar cota da semana.");
      return;
    }
    setFeedback("Cota da semana atualizada.");
    load(visibleWeekStart);
  }

  async function saveDayStatus(status: DayStatusValue) {
    if (!selectedDay) return;
    setSavingDayStatus(true);
    setFeedback(null);
    const res = await fetch("/api/admin/agenda/day-status", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: selectedDay, status }),
    });
    const data = await res.json().catch(() => ({}));
    setSavingDayStatus(false);
    if (!res.ok) {
      setFeedback(data.error ?? "Erro ao salvar status do dia.");
      return;
    }
    setFeedback("Status do dia atualizado.");
    load(visibleWeekStart);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Agenda</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Ocupação semanal e pedidos com data solicitada pelo cliente. Clique num dia para editar seu status ou lançar um pedido manual.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowManualOrderModal(true)}
          className="flex items-center gap-1.5 rounded-full bg-pink-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-pink-600"
        >
          <Plus className="h-4 w-4" /> Pedido manual
        </button>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div className="flex flex-col gap-4">
          <BookingCalendar
            occupancies={occupancies}
            horizonDays={horizonDays}
            visibleWeekStart={visibleWeekStart}
            onNavigateWeek={(dir) => setVisibleWeekStart((w) => addDays(w, dir * 7))}
            onSelectDate={(date) => setSelectedDay((d) => (d === date ? null : date))}
            selectedDate={selectedDay}
            dayStatusOverrides={dayStatusOverrides}
            adminMode
          />

          {/* Cota da semana visível */}
          <div className="rounded-3xl border border-pink-100 bg-white p-5">
            <h2 className="font-semibold text-ink">Cota de pedidos desta semana</h2>
            <p className="mt-1 text-xs text-ink-soft">
              {weekData?.has_override
                ? "Esta semana tem uma cota específica (sobrescreve o padrão global)."
                : "Esta semana usa a cota padrão global. Definir um valor aqui cria uma exceção só para ela."}
            </p>
            <div className="mt-3 flex items-center gap-2">
              <input
                type="number"
                min={1}
                value={capacityInput}
                onChange={(e) => setCapacityInput(e.target.value)}
                placeholder="Padrão global"
                className="w-32 rounded-xl border border-pink-200 px-3 py-2 text-sm focus:border-pink-400 focus:outline-none"
              />
              <button
                type="button"
                onClick={saveCapacity}
                disabled={savingCapacity}
                className="rounded-xl bg-pink-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-pink-600 disabled:opacity-50"
              >
                {savingCapacity ? "Salvando…" : "Salvar"}
              </button>
              {weekData?.has_override && (
                <button
                  type="button"
                  onClick={() => {
                    setCapacityInput("");
                    saveCapacity();
                  }}
                  disabled={savingCapacity}
                  className="rounded-xl border border-pink-200 px-3 py-2 text-sm text-ink-soft transition-colors hover:bg-pink-50"
                >
                  Remover exceção
                </button>
              )}
            </div>
          </div>

          {/* Status do dia selecionado */}
          {selectedDay && (
            <div className="rounded-3xl border border-pink-100 bg-white p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-semibold text-ink capitalize">{formatLong(selectedDay)}</h2>
                <button
                  type="button"
                  onClick={() => setShowManualOrderModal(true)}
                  className="flex items-center gap-1 text-xs font-medium text-pink-600 hover:underline"
                >
                  <Plus className="h-3.5 w-3.5" /> Lançar pedido neste dia
                </button>
              </div>
              <p className="mt-1 text-xs text-ink-soft">
                Sobrescreve a aparência/disponibilidade calculada só para este dia.
              </p>
              <div className="mt-3 flex flex-col gap-2">
                {DAY_STATUS_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => saveDayStatus(opt.value)}
                    disabled={savingDayStatus}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50 ${
                      selectedDayStatus === opt.value
                        ? "border-pink-500 bg-pink-50 font-medium text-pink-700"
                        : "border-pink-100 text-ink-soft hover:bg-pink-50"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {feedback && <p className="text-sm text-ink-soft">{feedback}</p>}
        </div>

        <div className="rounded-3xl border border-pink-100 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-semibold text-ink">
              {selectedDay ? `Pedidos de ${formatLong(selectedDay)}` : "Pedidos desta semana"}
            </h2>
            {selectedDay && (
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="text-xs font-medium text-pink-600 hover:underline"
              >
                Ver semana toda
              </button>
            )}
          </div>
          {loading ? (
            <p className="mt-3 text-sm text-ink-soft">Carregando…</p>
          ) : visibleOrders.length === 0 ? (
            <p className="mt-3 text-sm text-ink-soft">
              {selectedDay ? "Nenhum pedido agendado para este dia." : "Nenhum pedido com data agendada nesta semana."}
            </p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-pink-50">
              {visibleOrders.map((order) => (
                <li key={order.id} className="py-3">
                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="flex items-center justify-between gap-2 text-sm hover:text-pink-600"
                  >
                    <div>
                      <p className="font-medium text-ink">
                        {order.order_code} — {order.customer_name}
                      </p>
                      <p className="text-xs text-ink-soft">
                        {order.booking_date &&
                          new Date(order.booking_date + "T12:00:00").toLocaleDateString("pt-BR", {
                            weekday: "long", day: "2-digit", month: "2-digit",
                          })}
                        {" · "}{formatBRL(order.total_cents)}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <OrderStatusBadge status={order.status} />
                      <span className="text-xs font-medium text-ink-soft">
                        {BOOKING_LABEL[order.booking_status]}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showManualOrderModal && (
        <ManualOrderModal
          date={selectedDay ?? today}
          onClose={() => setShowManualOrderModal(false)}
          onCreated={() => load(visibleWeekStart)}
        />
      )}
    </div>
  );
}
