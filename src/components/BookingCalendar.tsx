"use client";

import { useMemo } from "react";
import { ChevronLeft, ChevronRight, Ban } from "lucide-react";

export interface WeekOccupancyData {
  week_start: string; // segunda-feira, YYYY-MM-DD
  count: number;
  capacity: number;
}

interface BookingCalendarProps {
  /** Ocupação por semana, já buscada da API /api/agenda. */
  occupancies: WeekOccupancyData[];
  /** Horizonte máximo de agendamento (dias a partir de hoje). */
  horizonDays: number;
  /** Semana atualmente visível no grid (segunda-feira, YYYY-MM-DD). */
  visibleWeekStart: string;
  onNavigateWeek: (direction: -1 | 1) => void;
  /** Se definido, calendário fica clicável e chama isto ao escolher um dia. */
  onSelectDate?: (date: string) => void;
  /** Data já selecionada (para destacar no grid). */
  selectedDate?: string | null;
  /** Somente leitura — não permite clique mesmo com onSelectDate definido. Usado no storefront conforme a spec (3.1). */
  readOnly?: boolean;
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShort(dateStr: string): string {
  return new Date(dateStr + "T12:00:00").toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  });
}

const WEEKDAY_LABELS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

/** Cor por faixa de ocupação — mapeamento exato pedido na especificação. */
function occupancyColor(count: number, capacity: number): {
  bg: string; border: string; text: string; label: string;
} {
  const pct = capacity > 0 ? count / capacity : 0;
  if (pct >= 1) {
    return { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", label: "Esgotado" };
  }
  if (pct >= 0.5) {
    return { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", label: "Vagas limitadas" };
  }
  return { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", label: "Alta disponibilidade" };
}

export default function BookingCalendar({
  occupancies,
  horizonDays,
  visibleWeekStart,
  onNavigateWeek,
  onSelectDate,
  selectedDate,
  readOnly = false,
}: BookingCalendarProps) {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const maxDate = useMemo(() => addDays(today, horizonDays), [today, horizonDays]);

  const weekData = occupancies.find((w) => w.week_start === visibleWeekStart);
  const count = weekData?.count ?? 0;
  const capacity = weekData?.capacity ?? 20;
  const colors = occupancyColor(count, capacity);
  const pct = capacity > 0 ? Math.min((count / capacity) * 100, 100) : 0;

  const days = Array.from({ length: 7 }, (_, i) => addDays(visibleWeekStart, i));
  const weekEnd = days[6];

  const canGoBack = visibleWeekStart > today.slice(0, 7) + "-01"; // não deixa navegar indefinidamente pro passado
  const canGoForward = addDays(visibleWeekStart, 7) <= maxDate;

  return (
    <div className="rounded-3xl border border-pink-100 bg-white p-5 shadow-sm">
      {/* Cabeçalho: navegação + barra de ocupação da semana */}
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onNavigateWeek(-1)}
          disabled={visibleWeekStart <= today}
          className="rounded-full p-2 text-ink-soft transition-colors hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Semana anterior"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="text-center">
          <p className="font-display text-sm font-semibold text-ink">
            {formatShort(visibleWeekStart)} – {formatShort(weekEnd)}
          </p>
          <p className={`text-xs font-medium ${colors.text}`}>
            {colors.label} · {count}/{capacity} pedidos
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigateWeek(1)}
          disabled={!canGoForward}
          className="rounded-full p-2 text-ink-soft transition-colors hover:bg-pink-50 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Próxima semana"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* Barra de progresso de capacidade semanal */}
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-pink-50">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 100 ? "bg-red-400" : pct >= 50 ? "bg-amber-400" : "bg-emerald-400"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Grid de dias da semana */}
      <div className="mt-5 grid grid-cols-7 gap-1.5 sm:gap-2">
        {days.map((date, i) => {
          const isPast = date < today;
          const isBeyondHorizon = date > maxDate;
          const isFull = capacity > 0 && count >= capacity;
          const isSelected = selectedDate === date;
          const clickable = !readOnly && onSelectDate && !isPast && !isBeyondHorizon && !isFull;

          let cellClasses = "flex flex-col items-center gap-1 rounded-2xl border py-3 text-xs transition-colors ";
          if (isPast || isBeyondHorizon) {
            cellClasses += "border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed";
          } else if (isFull) {
            cellClasses += `${colors.border} ${colors.bg} ${colors.text} cursor-not-allowed opacity-70`;
          } else if (isSelected) {
            cellClasses += "border-pink-500 bg-pink-500 text-white shadow-md";
          } else {
            cellClasses += `${colors.border} ${colors.bg} ${colors.text} ${
              clickable ? "cursor-pointer hover:scale-105 hover:shadow-md" : "cursor-default"
            }`;
          }

          return (
            <button
              key={date}
              type="button"
              disabled={!clickable}
              onClick={() => clickable && onSelectDate?.(date)}
              className={cellClasses}
            >
              <span className="font-semibold">{WEEKDAY_LABELS[i]}</span>
              <span className="text-[15px] font-bold">{date.slice(8, 10)}</span>
              {(isPast || isBeyondHorizon) && <Ban className="h-3 w-3" />}
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-ink-soft">
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /> Alta disponibilidade
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400" /> Vagas limitadas
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400" /> Esgotado
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-full bg-gray-200" /> Fora do prazo (máx. {horizonDays} dias)
        </span>
      </div>
    </div>
  );
}
