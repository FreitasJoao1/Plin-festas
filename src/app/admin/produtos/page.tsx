import Link from "next/link";
import Image from "next/image";
import { Plus } from "lucide-react";
import { getAllProductsAdmin } from "@/lib/products";
import { formatBRL } from "@/lib/shipping";
import { CATEGORY_LABELS } from "@/lib/mock-data";

export const metadata = { title: "Produtos — Admin Plin Designs" };

export default async function AdminProductsPage() {
  const products = await getAllProductsAdmin();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-ink">Produtos</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {products.length} produto(s) no catálogo.
          </p>
        </div>
        <Link
          href="/admin/produtos/novo"
          className="flex items-center gap-2 rounded-full bg-pink-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-lilac-500"
        >
          <Plus className="h-4 w-4" /> Novo produto
        </Link>
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-pink-100 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-pink-100 bg-pink-50/50 text-xs font-semibold uppercase text-ink-soft">
            <tr>
              <th className="px-4 py-3">Produto</th>
              <th className="px-4 py-3">Categoria</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3">Estoque</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-pink-50">
            {products.map((product) => (
              <tr key={product.id} className="hover:bg-pink-50/30">
                <td className="flex items-center gap-3 px-4 py-3">
                  <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg bg-pink-50">
                    {product.images[0] && (
                      <Image
                        src={product.images[0]}
                        alt=""
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    )}
                  </div>
                  <span className="font-medium text-ink">{product.name}</span>
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {CATEGORY_LABELS[product.category]}
                </td>
                <td className="px-4 py-3 text-ink-soft">
                  {formatBRL(product.price_cents)}
                </td>
                <td className="px-4 py-3 text-ink-soft">{product.stock}</td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                      product.active
                        ? "bg-green-100 text-green-700"
                        : "bg-ink/10 text-ink-soft"
                    }`}
                  >
                    {product.active ? "Ativo" : "Inativo"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/admin/produtos/${product.id}`}
                    className="font-semibold text-pink-600 hover:underline"
                  >
                    Editar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && (
          <p className="p-6 text-center text-ink-soft">
            Nenhum produto cadastrado ainda.
          </p>
        )}
      </div>
    </div>
  );
}
