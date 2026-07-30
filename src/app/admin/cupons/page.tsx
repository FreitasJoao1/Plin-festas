import Link from "next/link";
import { Plus } from "lucide-react";
import { getAllCouponsAdmin } from "@/lib/coupons";
import { formatBRL } from "@/lib/shipping";
import { CATEGORY_LABELS } from "@/lib/mock-data";

export const metadata = { title: "Cupons — Admin Plin Designs" };

function scopeLabel(coupon: Awaited<ReturnType<typeof getAllCouponsAdmin>>[number]): string {
  if (coupon.scope === "all") return "Todo o carrinho";
  if (coupon.scope === "category") {
    return coupon.scope_category ? CATEGORY_LABELS[coupon.scope_category] : "Categoria";
  }
  return `${coupon.scope_product_ids.length} produto(s)`;
}

export default async function AdminCouponsPage() {
  const coupons = await getAllCouponsAdmin();
  const now = Date.now();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Cupons de desconto</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {coupons.length} cupom(ns) cadastrado(s).
          </p>
        </div>
        <Link
          href="/admin/cupons/novo"
          className="flex items-center gap-2 rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lilac-500"
        >
          <Plus className="h-4 w-4" /> Novo cupom
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-pink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-pink-100 bg-pink-50/50 text-xs font-semibold uppercase text-ink-soft">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Desconto</th>
              <th className="px-4 py-3">Aplica-se a</th>
              <th className="px-4 py-3">Usos</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {coupons.map((coupon) => {
              const expired = coupon.valid_until && new Date(coupon.valid_until).getTime() < now;
              const exhausted = coupon.max_uses !== null && coupon.used_count >= coupon.max_uses;
              const effectivelyActive = coupon.active && !expired && !exhausted;

              return (
                <tr key={coupon.id} className="hover:bg-pink-50/30">
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-ink">{coupon.code}</span>
                    {coupon.description && (
                      <p className="text-xs text-ink-soft">{coupon.description}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {coupon.discount_type === "percentage"
                      ? `${coupon.discount_value}%`
                      : formatBRL(coupon.discount_value)}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{scopeLabel(coupon)}</td>
                  <td className="px-4 py-3 text-ink-soft">
                    {coupon.used_count}
                    {coupon.max_uses !== null ? ` / ${coupon.max_uses}` : ""}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                        effectivelyActive
                          ? "bg-green-100 text-green-700"
                          : "bg-ink/10 text-ink-soft"
                      }`}
                    >
                      {effectivelyActive
                        ? "Ativo"
                        : exhausted
                          ? "Esgotado"
                          : expired
                            ? "Expirado"
                            : "Inativo"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/cupons/${coupon.id}`}
                      className="font-semibold text-pink-600 hover:underline"
                    >
                      Editar
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {coupons.length === 0 && (
          <p className="p-6 text-center text-ink-soft">Nenhum cupom cadastrado ainda.</p>
        )}
      </div>
    </div>
  );
}
