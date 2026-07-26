import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOrdersForUser } from "@/lib/orders";
import { formatBRL } from "@/lib/shipping";
import OrderStatusBadge from "@/components/OrderStatusBadge";

export const metadata = { title: "Minha conta — Plin Designs" };

/**
 * Página de pedidos do cliente. O middleware (src/lib/supabase/middleware.ts)
 * já redireciona para /login quando não há usuário logado em modo real —
 * mas em modo demo (sem Supabase) o middleware não faz nada, então
 * tratamos os dois casos aqui também, como pedido no briefing original.
 */
export default async function ContaPage() {
  const supabase = await createClient();

  if (!supabase) {
    return (
      <div className="container-plin py-16 text-center">
        <h1 className="font-display text-2xl text-ink">Minha conta</h1>
        <p className="mt-3 text-ink-soft">
          Login e histórico de pedidos ainda não estão disponíveis neste
          ambiente (modo demo — o Supabase não foi configurado).
        </p>
        <Link
          href="/produtos"
          className="mt-6 inline-block rounded-full bg-pink-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-lilac-500"
        >
          Ver produtos
        </Link>
      </div>
    );
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="container-plin py-16 text-center">
        <h1 className="font-display text-2xl text-ink">Minha conta</h1>
        <p className="mt-3 text-ink-soft">
          Você precisa entrar para ver seus pedidos.
        </p>
        <Link
          href="/login?redirect=/conta"
          className="mt-6 inline-block rounded-full bg-pink-500 px-6 py-3 font-semibold text-white transition-colors hover:bg-lilac-500"
        >
          Entrar
        </Link>
      </div>
    );
  }

  const orders = await getOrdersForUser(user.id);

  return (
    <div className="container-plin py-10">
      <h1 className="font-display text-3xl text-ink">Meus pedidos</h1>

      {orders.length === 0 ? (
        <p className="mt-6 text-ink-soft">
          Você ainda não fez nenhum pedido.{" "}
          <Link href="/produtos" className="font-medium text-pink-600">
            Que tal começar por aqui?
          </Link>
        </p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          {orders.map((order) => (
            <div
              key={order.id}
              className="rounded-3xl border border-pink-100 p-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-mono text-xs text-ink-soft">
                    Pedido #{order.id.slice(0, 8)}
                  </p>
                  <p className="text-sm text-ink-soft">
                    {new Date(order.created_at).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <OrderStatusBadge status={order.status} />
              </div>

              <ul className="mt-3 flex flex-col gap-1 border-t border-pink-100 pt-3">
                {order.items.map((item) => (
                  <li
                    key={item.product_id}
                    className="flex justify-between text-sm text-ink-soft"
                  >
                    <span>
                      {item.quantity}× {item.name}
                    </span>
                    <span>
                      {formatBRL(item.unit_price_cents * item.quantity)}
                    </span>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex justify-between border-t border-pink-100 pt-3 text-sm font-semibold text-ink">
                <span>Total</span>
                <span>{formatBRL(order.total_cents)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
