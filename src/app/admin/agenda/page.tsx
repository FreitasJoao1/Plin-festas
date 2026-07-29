"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BookingCalendar, { WeekOccupancyData, DayScheduleData } from "@/components/BookingCalendar";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import { Order } from "@/lib/types";
import { formatBRL } from "@/lib/shipping";
import { ChevronDown, ToggleLeft, ToggleRight, Trash2 } from "lucide-react";

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

const BOOKING_LABEL: Record<Order["booking_status"], string> = {
  pending_approval: "⏳ Aguardando",
  approved: "✅ Aprovado",
  rejected: "❌ Recusado",
};

export default function AdminAgendaPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => mondayOf(today));
  const [occupancies, setOccupancies] = useState<WeekOccupancyData[]>([]);
  const [daySchedules, setDaySchedules] = useState<DayScheduleData[]>([]);
  const [horizonDays, setHorizonDays] = useState(60);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [editingDay, setEditingDay] = useState<{ day: string; isOpen: boolean; reason: string }>();

  const load = useCallback((weekStart: string) => {
    setLoading(true);
    const start = weekStart;
    const end = addDays(weekStart, 6);
    Promise.all([
      fetch(`/api/admin/agenda?start=${start}&end=${end}`).then((r) => r.json()),
      fetch(`/api/admin/day-schedules?start=${start}&end=${end}`).then((r) => r.json()),
    ])
      .then(([agendaData, schedulesData]) => {
        if (agendaData.weeks) setOccupancies(agendaData.weeks);
        if (agendaData.settings?.horizon_days) setHorizonDays(agendaData.settings.horizon_days);
        if (agendaData.orders) setOrders(agendaData.orders);
        if (schedulesData.schedules) setDaySchedules(schedulesData.schedules);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(visibleWeekStart);
  }, [visibleWeekStart, load]);

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Agenda</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Ocupação semanal e pedidos com data solicitada pelo cliente.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.2fr]">
        <BookingCalendar
          occupancies={occupancies}
          horizonDays={horizonDays}
          visibleWeekStart={visibleWeekStart}
          onNavigateWeek={(dir) => setVisibleWeekStart((w) => addDays(w, dir * 7))}
          daySchedules={daySchedules}
        />

        <div className="flex flex-col gap-6">
          {/* Dias da semana editáveis */}
          <div className="rounded-3xl border border-pink-100 bg-white p-5">
            <h2 className="font-semibold text-ink">Gerenciar dias da semana</h2>
            <div className="mt-4 flex flex-col divide-y divide-pink-50">
              {Array.from({ length: 7 }, (_, i) => addDays(visibleWeekStart, i)).map((date) => {
                const daySchedule = daySchedules.find(d => d.day === date);
                const isOpen = daySchedule ? daySchedule.is_open : true;
                const isPast = date < new Date().toISOString().slice(0, 10);
                return (
                  <div key={date} className="py-3 first:pt-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-ink">
                          {new Date(date + "T12:00:00").toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit" })}
                        </p>
                        {daySchedule?.reason && <p className="text-xs text-ink-soft mt-1">{daySchedule.reason}</p>}
                      </div>
                      <button
                        onClick={() => setExpandedDay(expandedDay === date ? null : date)}
                        className="rounded-lg p-2 text-ink-soft hover:bg-pink-50"
                      >
                        <ChevronDown className={`h-5 w-5 transition-transform ${expandedDay === date ? "rotate-180" : ""}`} />
                      </button>
                    </div>
                    
                    {expandedDay === date && (
                      <div className="mt-3 space-y-3 border-t border-pink-50 pt-3">
                        <button
                          onClick={() => {
                            fetch(`/api/admin/day-schedules`, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ day: date, is_open: !isOpen }),
                            }).then((r) => r.json()).then(() => load(visibleWeekStart));
                          }}
                          disabled={isPast}
                          className="flex w-full items-center gap-2 rounded-lg bg-pink-50 p-3 text-sm font-medium text-ink hover:bg-pink-100 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {isOpen ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                          {isOpen ? "Fechar dia" : "Abrir dia"}
                        </button>
                        
                        {!isOpen && (
                          <input
                            type="text"
                            placeholder="Motivo (ex: feriado, manutenção)"
                            value={editingDay?.day === date ? editingDay.reason : daySchedule?.reason || ""}
                            onChange={(e) => setEditingDay({ day: date, isOpen: false, reason: e.target.value })}
                            className="w-full rounded-lg border border-pink-100 px-3 py-2 text-sm placeholder-ink-soft focus:border-pink-500 focus:outline-none"
                          />
                        )}
                        
                        {daySchedule && (
                          <button
                            onClick={() => {
                              fetch(`/api/admin/day-schedules?day=${date}`, { method: "DELETE" }).then(() => load(visibleWeekStart));
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg bg-red-50 p-2 text-xs font-medium text-red-600 hover:bg-red-100"
                          >
                            <Trash2 className="h-4 w-4" /> Remover customização
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Pedidos da semana */}
          <div className="rounded-3xl border border-pink-100 bg-white p-5">
            <h2 className="font-semibold text-ink">Pedidos desta semana</h2>
            {loading ? (
              <p className="mt-3 text-sm text-ink-soft">Carregando…</p>
            ) : orders.length === 0 ? (
              <p className="mt-3 text-sm text-ink-soft">Nenhum pedido com data agendada nesta semana.</p>
            ) : (
              <ul className="mt-3 flex flex-col divide-y divide-pink-50">
                {orders.map((order) => (
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
      </div>
    </div>
  );
}
