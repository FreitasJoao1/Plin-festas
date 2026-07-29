"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import BookingCalendar, { WeekOccupancyData } from "@/components/BookingCalendar";
import OrderStatusBadge from "@/components/OrderStatusBadge";
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

const BOOKING_LABEL: Record<Order["booking_status"], string> = {
  pending_approval: "⏳ Aguardando",
  approved: "✅ Aprovado",
  rejected: "❌ Recusado",
};

export default function AdminAgendaPage() {
  const today = new Date().toISOString().slice(0, 10);
  const [visibleWeekStart, setVisibleWeekStart] = useState(() => mondayOf(today));
  const [occupancies, setOccupancies] = useState<WeekOccupancyData[]>([]);
  const [horizonDays, setHorizonDays] = useState(60);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

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
        />

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
  );
}
