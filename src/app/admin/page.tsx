import Link from "next/link";
import { DollarSign, ShoppingCart, Sparkles, PackageX } from "lucide-react";
import { getOrderMetrics } from "@/lib/orders";
import { getAllProductsAdmin } from "@/lib/products";
import { formatBRL } from "@/lib/shipping";
import OrderStatusBadge from "@/components/OrderStatusBadge";
import DashboardCharts from "@/components/admin/DashboardCharts";

export const metadata = { title: "Dashboard — Admin Plin Designs" };

export default async function AdminDashboardPage() {
  const [metrics, products] = await Promise.all([
    getOrderMetrics(),
    getAllProductsAdmin(),
  ]);

  const lowStock = products
    .filter((p) => p.active && p.stock <= 5)
    .sort((a, b) => a.stock - b.stock);

  const cards = [
    {
      label: "Receita (confirmado em diante)",
      value: formatBRL(metrics.totalRevenueCents),
      icon: DollarSign,
    },
    { label: "Total de pedidos", value: String(metrics.totalOrders), icon: ShoppingCart },
    { label: "Pedidos novos", value: String(metrics.pendingCount), icon: Sparkles },
    {
      label: "Produtos com estoque baixo",
      value: String(lowStock.length),
      icon: PackageX,
    },
  ];

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Dashboard</h1>
      <p className="mt-1 text-sm text-ink-soft">Visão geral da loja.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-3xl border border-pink-100 bg-white p-5 transition-shadow hover:shadow-md"
          >
            <Icon className="h-5 w-5 text-pink-500" />
            <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
            <p className="text-sm text-ink-soft">{label}</p>
          </div>
        ))}
      </div>

      <DashboardCharts metrics={metrics} />

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-pink-100 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Pedidos recentes</h2>
            <Link
              href="/admin/pedidos"
              className="text-sm font-semibold text-pink-600 hover:underline"
            >
              Ver todos
            </Link>
          </div>

          {metrics.recentOrders.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">Nenhum pedido ainda.</p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-pink-50">
              {metrics.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="flex items-center justify-between py-3 text-sm transition-colors hover:text-pink-600"
                  >
                    <div>
                      <p className="font-mono text-xs text-ink-soft">{order.order_code}</p>
                      <p className="font-medium text-ink">{order.customer_name}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-ink-soft">
                        {formatBRL(order.total_cents)}
                      </span>
                      <OrderStatusBadge status={order.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-3xl border border-pink-100 bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg text-ink">Estoque baixo</h2>
            <Link
              href="/admin/produtos"
              className="text-sm font-semibold text-pink-600 hover:underline"
            >
              Ver produtos
            </Link>
          </div>

          {lowStock.length === 0 ? (
            <p className="mt-4 text-sm text-ink-soft">
              Nenhum produto com estoque baixo. 🎉
            </p>
          ) : (
            <ul className="mt-4 flex flex-col divide-y divide-pink-50">
              {lowStock.slice(0, 8).map((product) => (
                <li key={product.id}>
                  <Link
                    href={`/admin/produtos/${product.id}`}
                    className="flex items-center justify-between py-3 text-sm transition-colors hover:text-pink-600"
                  >
                    <span className="font-medium text-ink">{product.name}</span>
                    <span
                      className={
                        product.stock === 0
                          ? "font-semibold text-red-600"
                          : "text-amber-600"
                      }
                    >
                      {product.stock} un.
                    </span>
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
