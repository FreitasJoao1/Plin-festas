import Link from "next/link";
import { getAllOrders } from "@/lib/orders";
import { formatBRL } from "@/lib/shipping";
import OrderStatusBadge from "@/components/OrderStatusBadge";

export const metadata = { title: "Pedidos — Admin Plin Designs" };

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div>
      <h1 className="font-display text-2xl text-ink">Pedidos</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {orders.length} pedido(s) no total.
      </p>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-pink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-pink-100 bg-pink-50/50 text-xs font-semibold uppercase text-ink-soft">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Data</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {orders.map((order) => (
              <tr key={order.id} className="transition-colors hover:bg-pink-50/30">
                <td className="px-4 py-3 font-mono text-xs text-ink">{order.order_code}</td>
                <td className="px-4 py-3">
                  <p className="font-medium text-ink">{order.customer_name}</p>
                  <p className="text-xs text-ink-soft">{order.customer_phone}</p>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {new Date(order.created_at).toLocaleDateString("pt-BR")}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {formatBRL(order.total_cents)}
                </td>
                <td className="px-4 py-3">
                  <OrderStatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/pedidos/${order.id}`}
                    className="font-semibold text-pink-600 transition-colors hover:text-lilac-500 hover:underline"
                  >
                    Ver detalhes
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && (
          <p className="p-6 text-center text-ink-soft">Nenhum pedido ainda.</p>
        )}
      </div>
    </div>
  );
}
