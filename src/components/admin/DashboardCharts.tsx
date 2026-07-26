"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { OrderMetrics } from "@/lib/orders";
import { formatBRL } from "@/lib/shipping";

const STATUS_COLORS: Record<string, string> = {
  novo: "#82CBE9",
  confirmado: "#AD87DC",
  em_producao: "#F2578C",
  pronto: "#34D399",
  enviado: "#818CF8",
  entregue: "#22C55E",
  cancelado: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  novo: "Novo",
  confirmado: "Confirmado",
  em_producao: "Em produção",
  pronto: "Pronto",
  enviado: "Enviado",
  entregue: "Entregue",
  cancelado: "Cancelado",
};

export default function DashboardCharts({ metrics }: { metrics: OrderMetrics }) {
  const statusData = Object.entries(metrics.statusBreakdown)
    .filter(([, count]) => count > 0)
    .map(([status, count]) => ({
      name: STATUS_LABELS[status] ?? status,
      value: count,
      color: STATUS_COLORS[status] ?? "#ccc",
    }));

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-3">
      {/* Receita ao longo do tempo */}
      <div className="rounded-3xl border border-pink-100 bg-white p-6 lg:col-span-2">
        <h2 className="font-display text-lg text-ink">Receita — últimos 14 dias</h2>
        <div className="mt-4 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={metrics.dailySeries}>
              <defs>
                <linearGradient id="revGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F2578C" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#F2578C" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#FFE3ED" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B5A68" }} />
              <YAxis
                tick={{ fontSize: 11, fill: "#6B5A68" }}
                tickFormatter={(v) => formatBRL(v).replace(",00", "")}
                width={70}
              />
              <Tooltip
                formatter={(value: number) => formatBRL(value)}
                labelStyle={{ color: "#3A2E39" }}
                contentStyle={{ borderRadius: 12, border: "1px solid #FFE3ED" }}
              />
              <Area
                type="monotone"
                dataKey="revenueCents"
                stroke="#F2578C"
                strokeWidth={2}
                fill="url(#revGradient)"
                name="Receita"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Pedidos por status */}
      <div className="rounded-3xl border border-pink-100 bg-white p-6">
        <h2 className="font-display text-lg text-ink">Pedidos por status</h2>
        <div className="mt-4 h-64">
          {statusData.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-ink-soft">
              Sem pedidos ainda.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={3}
                >
                  {statusData.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #FFE3ED" }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-x-3 gap-y-1">
          {statusData.map((s) => (
            <span key={s.name} className="flex items-center gap-1.5 text-xs text-ink-soft">
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.name} ({s.value})
            </span>
          ))}
        </div>
      </div>

      {/* Pedidos por dia */}
      <div className="rounded-3xl border border-pink-100 bg-white p-6">
        <h2 className="font-display text-lg text-ink">Pedidos por dia</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={metrics.dailySeries}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F2ECFB" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6B5A68" }} />
              <YAxis tick={{ fontSize: 11, fill: "#6B5A68" }} allowDecimals={false} width={30} />
              <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #F2ECFB" }} />
              <Bar dataKey="orders" fill="#AD87DC" radius={[6, 6, 0, 0]} name="Pedidos" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top produtos */}
      <div className="rounded-3xl border border-pink-100 bg-white p-6 lg:col-span-2">
        <h2 className="font-display text-lg text-ink">Produtos mais pedidos</h2>
        <div className="mt-4 h-56">
          {metrics.topProducts.length === 0 ? (
            <p className="flex h-full items-center justify-center text-sm text-ink-soft">
              Sem dados suficientes ainda.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={metrics.topProducts} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#EAF7FD" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#6B5A68" }} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fontSize: 11, fill: "#3A2E39" }}
                  width={140}
                />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #EAF7FD" }} />
                <Bar dataKey="quantity" fill="#82CBE9" radius={[0, 6, 6, 0]} name="Unidades" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}
